import { WebView } from "./webview2";
/**
 * Options for configuring the SMART Web Messaging connector
 */
type Options = {
    autoInitialize?: boolean;
    timeoutMs: number;
    maxRetries: number;
};
/**
 * Parameters required for SMART Web Messaging
 */
type SMARTMessagingParams = {
    origin: string | null;
    handle: string;
};
/**
 * Structure of an outgoing request message
 */
type RequestMessage = {
    messagingHandle: string;
    messageId: string;
    messageType: string;
    payload: Record<string, unknown>;
};
/**
 * Structure of an incoming response message
 */
type ResponseMessage = {
    messageId: string;
    responseToMessageId: string;
    additionalResponseExpected?: boolean;
    payload: Record<string, unknown>;
};
export type RequestMessageType = "form.requestSubmit" | "form.checkValidity" | "form.persist";
/**
 * Possible connection states for the messaging connector
 */
export type Status = "connecting" | "connected" | "disconnected" | "error";
/**
 * Handles SMART Web Messaging communication between windows/frames
 */
export default class SMARTWebMessagingConnector {
    private _status;
    private _listeners;
    private _handlers;
    private _pendingHandshake;
    readonly options: Options;
    readonly params: SMARTMessagingParams;
    readonly ehrWindow: Window | WebView;
    /**
     * Creates a new SMART Web Messaging connector instance
     */
    constructor(window: Window, params: SMARTMessagingParams, options?: Options);
    /**
     * Checks if connection is in 'connected' state
     */
    get isConnectionReady(): boolean;
    /**
     * Generates a random message ID
     */
    static generateMessageId(): string;
    /**
     * Ensures connection is initialized before proceeding
     */
    ensureConnection(): Promise<void>;
    /**
     * Adds a status change event listener
     */
    addEventListener(type: "statusChange", listener: (status: Status) => void): void;
    /**
     * Removes a status change event listener
     */
    removeEventListener(type: "statusChange", listener: (status: Status) => void): boolean;
    /**
     * Updates connection status and notifies listeners
     */
    private setStatus;
    /**
     * Sends a message and waits for response
     */
    sendMessage<TRequestMessage extends Pick<RequestMessage, "messageType" | "payload">, TResponseMessage extends Pick<ResponseMessage, "payload">>(messageType: TRequestMessage["messageType"], payload?: TRequestMessage["payload"]): Promise<ResponseMessage & TResponseMessage>;
    postMessage(message: unknown): void;
    /**
     * Sets up the message listener for incoming messages
     */
    private setupMessageListener;
    /**
     * Handles incoming messages and dispatches them to appropriate handlers
     */
    private handleIncomingMessage;
    /**
     * Handles incoming messages of a specific type
     * @param messageType The type of message to handle
     * @param handler The function to call when a message of the specified type is received
     */
    on<TMessageType extends RequestMessageType>(messageType: TMessageType, handler: (message: RequestMessage & {
        messageType: TMessageType;
    }) => unknown): void;
    /**
     * Removes a handler for a specific message type
     * @param messageType The type of message to stop handling
     * @returns true if a handler was removed, false if no handler was found
     */
    removeHandler(messageType: RequestMessageType): boolean;
    /**
     * Checks if a handler is registered for a specific message type
     * @param messageType The type of message to check
     * @returns true if a handler is registered, false otherwise
     */
    hasHandler(messageType: RequestMessageType): boolean;
    /**
     * Gets all registered message types
     * @returns An array of all message types that have handlers
     */
    getRegisteredMessageTypes(): RequestMessageType[];
    /**
     * Gets the count of registered handlers
     * @returns The number of registered message handlers
     */
    getHandlerCount(): number;
    connect(): Promise<unknown>;
    connectWithRetry(): Promise<void>;
    /**
     * Returns current connection status
     */
    get status(): Status;
    /**
     * Closes the messaging connection
     */
    close(): void;
    /**
     * Cleans up event listeners and resources
     */
    private cleanup;
    static buildFromWindow(window: Window, params: SMARTMessagingParams): SMARTWebMessagingConnector;
}
export {};
