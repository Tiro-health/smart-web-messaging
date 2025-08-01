"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Wraps a promise with a timeout that rejects if the operation takes too long
 */
function withTimeout(promise, ms) {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${ms} ms`)), ms));
    return Promise.race([promise, timeout]);
}
/**
 * Handles SMART Web Messaging communication between windows/frames
 */
class SMARTWebMessagingConnector {
    /**
     * Creates a new SMART Web Messaging connector instance
     */
    constructor(window, params, options = { timeoutMs: 500, maxRetries: 3 }) {
        this._status = "disconnected";
        this._listeners = {
            statusChange: new Set(),
        };
        this._handlers = new Map();
        this._pendingHandshake = null;
        console.debug(`Creating connector with handle='${params.handle}' for origin='${params.origin}'`);
        this.params = params;
        this.ehrWindow = window;
        this.options = options;
        // Set up message listener for incoming messages
        this.setupMessageListener();
        if (options.autoInitialize) {
            this.connectWithRetry();
        }
    }
    /**
     * Checks if connection is in 'connected' state
     */
    get isConnectionReady() {
        return this.status == "connected";
    }
    /**
     * Generates a random message ID
     */
    static generateMessageId() {
        return Math.random().toString(36).substring(2, 15);
    }
    /**
     * Ensures connection is initialized before proceeding
     */
    ensureConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            console.debug("Ensure connection is established.");
            if (this.status != "connected") {
                yield this.connectWithRetry();
            }
            if (this.status == "error") {
                throw new Error("Connection error");
            }
        });
    }
    /**
     * Adds a status change event listener
     */
    addEventListener(type, listener) {
        this._listeners[type].add(listener);
    }
    /**
     * Removes a status change event listener
     */
    removeEventListener(type, listener) {
        return this._listeners[type].delete(listener);
    }
    /**
     * Updates connection status and notifies listeners
     */
    setStatus(status) {
        this._status = status;
        this._listeners["statusChange"].forEach((listener) => listener(status));
    }
    /**
     * Sends a message and waits for response
     */
    sendMessage(messageType, payload = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            /** Message Header */
            const messageId = SMARTWebMessagingConnector.generateMessageId();
            const messagingHandle = this.params.handle;
            return new Promise((resolve) => {
                const message = { messageType, payload, messageId, messagingHandle };
                const responseHandler = (event) => {
                    const response = event.data;
                    if (response.responseToMessageId === messageId) {
                        console.debug(`[Incoming SmartWeb Response] Handle: ${this.params.handle}, ResponseTo: ${response.responseToMessageId}, AdditionalExpected: ${response.additionalResponseExpected || false}, Payload:`, response.payload);
                        resolve(response);
                        if (!response.additionalResponseExpected)
                            this.ehrWindow.removeEventListener("message", responseHandler);
                    }
                    else {
                        console.debug(`[Incoming SmartWeb Response] Handle: ${this.params.handle}, Ignoring response for messageId '${response.responseToMessageId}', expected '${messageId}'`);
                    }
                };
                window.addEventListener("message", responseHandler);
                console.debug(`[Outgoing SmartWeb Message] Handle: ${this.params.handle}, Origin: ${this.params.origin || "any"}, Message:`, message);
                this.postMessage(message);
            });
        });
    }
    postMessage(message) {
        var _a, _b;
        if (this.params.origin) {
            (_a = this.ehrWindow) === null || _a === void 0 ? void 0 : _a.postMessage(message, this.params.origin);
        }
        else {
            (_b = this.ehrWindow) === null || _b === void 0 ? void 0 : _b.postMessage(message);
        }
    }
    /**
     * Sets up the message listener for incoming messages
     */
    setupMessageListener() {
        window.addEventListener("message", this.handleIncomingMessage.bind(this));
    }
    /**
     * Handles incoming messages and dispatches them to appropriate handlers
     */
    handleIncomingMessage(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (event.source == this.ehrWindow)
                    return; // Ignore messages from the same window
                const message = event.data;
                // Validate message structure
                if (!message || typeof message !== "object") {
                    return;
                }
                // Check if message is for this messaging handle
                if (message.messagingHandle !== this.params.handle) {
                    console.debug(`Ignoring message for handle '${message.messagingHandle}', expected '${this.params.handle}'`);
                    return;
                }
                if (!("messageType" in message))
                    return;
                // Check if we have a handler for this message type
                const messageType = message.messageType;
                const handler = this._handlers.get(messageType);
                if (handler) {
                    console.debug(`Dispatching message of type: ${messageType}`);
                    const result = yield handler(message);
                    if (result && typeof result === "object") {
                        // If the handler returns a response, send it back
                        const responseMsg = {
                            messageId: SMARTWebMessagingConnector.generateMessageId(),
                            responseToMessageId: message.messageId,
                            payload: result,
                            additionalResponseExpected: false, // Set to true if more responses are expected
                        };
                        this.postMessage(responseMsg);
                    }
                }
                else {
                    console.debug(`No handler registered for message type: ${messageType}`, this._handlers);
                }
            }
            catch (error) {
                console.error("Error handling incoming message:", error);
            }
        });
    }
    /**
     * Handles incoming messages of a specific type
     * @param messageType The type of message to handle
     * @param handler The function to call when a message of the specified type is received
     */
    on(messageType, handler) {
        console.debug(`Registering handler for message type: ${messageType}`);
        this._handlers.set(messageType, handler);
    }
    /**
     * Removes a handler for a specific message type
     * @param messageType The type of message to stop handling
     * @returns true if a handler was removed, false if no handler was found
     */
    removeHandler(messageType) {
        return this._handlers.delete(messageType);
    }
    /**
     * Checks if a handler is registered for a specific message type
     * @param messageType The type of message to check
     * @returns true if a handler is registered, false otherwise
     */
    hasHandler(messageType) {
        return this._handlers.has(messageType);
    }
    /**
     * Gets all registered message types
     * @returns An array of all message types that have handlers
     */
    getRegisteredMessageTypes() {
        return Array.from(this._handlers.keys());
    }
    /**
     * Gets the count of registered handlers
     * @returns The number of registered message handlers
     */
    getHandlerCount() {
        return this._handlers.size;
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.status == "connecting" && this._pendingHandshake) {
                return yield this._pendingHandshake;
            }
            console.debug("Establishing connection.");
            this.setStatus("connecting");
            this._pendingHandshake = withTimeout(this.sendMessage("status.handshake"), this.options.timeoutMs)
                .then(() => {
                this.setStatus("connected");
                console.debug("Connection established.");
            })
                .catch((reason) => {
                if (this.status !== "connecting")
                    return;
                this.setStatus("error");
                throw reason;
            });
            yield this._pendingHandshake;
        });
    }
    connectWithRetry() {
        return __awaiter(this, void 0, void 0, function* () {
            let retries = 0;
            while (retries < this.options.maxRetries) {
                console.debug(`Attempt ${retries + 1} to connect`);
                try {
                    yield this.connect();
                    return;
                }
                catch (error) {
                    console.debug("Failed to initialize connection:", error);
                }
                retries++;
            }
            throw new Error(`Failed to establish connection after ${this.options.maxRetries} retries`);
        });
    }
    /**
     * Returns current connection status
     */
    get status() {
        return this._status;
    }
    /**
     * Closes the messaging connection
     */
    close() {
        this.sendMessage("ui.close");
        this.cleanup();
    }
    /**
     * Cleans up event listeners and resources
     */
    cleanup() {
        window.removeEventListener("message", this.handleIncomingMessage);
        this._listeners.statusChange.clear();
        this._handlers.clear();
    }
    static buildFromWindow(window, params) {
        var _a, _b, _c, _d, _e;
        const ehrWindow = window.parent !== window.self
            ? window.parent
            : ((_c = (_a = window.opener) !== null && _a !== void 0 ? _a : (_b = window.chrome) === null || _b === void 0 ? void 0 : _b.webview) !== null && _c !== void 0 ? _c : window.parent);
        return new SMARTWebMessagingConnector(ehrWindow, {
            handle: params.handle,
            origin: (_d = params.origin) !== null && _d !== void 0 ? _d : (_e = ehrWindow === null || ehrWindow === void 0 ? void 0 : ehrWindow.location) === null || _e === void 0 ? void 0 : _e.window,
        }, {
            timeoutMs: 1000,
            maxRetries: 3,
        });
    }
}
exports.default = SMARTWebMessagingConnector;
