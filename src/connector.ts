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

/**
 * Wraps a promise with a timeout that rejects if the operation takes too long
 */
function withTimeout<T>(promise: Promise<T>, ms: number) {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Operation timed out after ${ms} ms`)),
      ms,
    ),
  );
  return Promise.race([promise, timeout]);
}

export type RequestMessageType =
  | "form.requestSubmit"
  | "form.checkValidity"
  | "form.persist";

type MessageHandler = (message: RequestMessage) => unknown | Promise<unknown>;

/**
 * Possible connection states for the messaging connector
 */
export type Status = "connecting" | "connected" | "disconnected" | "error";

/**
 * Handles SMART Web Messaging communication between windows/frames
 */
export default class SMARTWebMessagingConnector {
  private _status: Status;
  private _listeners: {
    statusChange: Set<(status: Status) => void>;
  };
  private _handlers: Map<RequestMessageType, MessageHandler>;
  private _pendingHandshake: Promise<unknown> | null;
  public readonly options: Options;
  public readonly params: SMARTMessagingParams;
  public readonly ehrWindow: Window | WebView;

  /**
   * Creates a new SMART Web Messaging connector instance
   */
  constructor(
    window: Window,
    params: SMARTMessagingParams,
    options: Options = { timeoutMs: 500, maxRetries: 3 },
  ) {
    this._status = "disconnected";
    this._listeners = {
      statusChange: new Set(),
    };
    this._handlers = new Map();
    this._pendingHandshake = null;
    console.debug(
      `Creating connector with handle='${params.handle}' for origin='${params.origin}'`,
    );
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
  public async ensureConnection() {
    console.debug("Ensure connection is established.");
    if (this.status != "connected") {
      await this.connectWithRetry();
    }
    if (this.status == "error") {
      throw new Error("Connection error");
    }
  }

  /**
   * Adds a status change event listener
   */
  public addEventListener(
    type: "statusChange",
    listener: (status: Status) => void,
  ) {
    this._listeners[type].add(listener);
  }

  /**
   * Removes a status change event listener
   */
  public removeEventListener(
    type: "statusChange",
    listener: (status: Status) => void,
  ) {
    return this._listeners[type].delete(listener);
  }

  /**
   * Updates connection status and notifies listeners
   */
  private setStatus(status: Status) {
    this._status = status;
    this._listeners["statusChange"].forEach((listener) => listener(status));
  }

  /**
   * Sends a message and waits for response
   */
  public async sendMessage<
    TRequestMessage extends Pick<RequestMessage, "messageType" | "payload">,
    TResponseMessage extends Pick<ResponseMessage, "payload">,
  >(
    messageType: TRequestMessage["messageType"],
    payload: TRequestMessage["payload"] = {},
  ): Promise<ResponseMessage & TResponseMessage> {
    /** Message Header */
    const messageId = SMARTWebMessagingConnector.generateMessageId();
    const messagingHandle = this.params.handle;

    return new Promise<ResponseMessage & TResponseMessage>((resolve) => {
      const message = { messageType, payload, messageId, messagingHandle };
      const responseHandler = (event: unknown) => {
        const response = (
          event as MessageEvent<ResponseMessage & TResponseMessage>
        ).data;
        if (response.responseToMessageId === messageId) {
          console.debug(
            `[Incoming SmartWeb Response] Handle: ${this.params.handle}, ResponseTo: ${response.responseToMessageId}, AdditionalExpected: ${response.additionalResponseExpected || false}, Payload:`,
            response.payload,
          );
          resolve(response);
          if (!response.additionalResponseExpected)
            this.ehrWindow.removeEventListener("message", responseHandler);
        } else {
          console.debug(
            `[Incoming SmartWeb Response] Handle: ${this.params.handle}, Ignoring response for messageId '${response.responseToMessageId}', expected '${messageId}'`,
          );
        }
      };
      window.addEventListener("message", responseHandler);
      console.debug(
        `[Outgoing SmartWeb Message] Handle: ${this.params.handle}, Origin: ${this.params.origin || "any"}, Message:`,
        message,
      );
      this.postMessage(message);
    });
  }

  public postMessage(message: unknown) {
    if (this.params.origin) {
      this.ehrWindow?.postMessage(message, this.params.origin);
    } else {
      this.ehrWindow?.postMessage(message);
    }
  }

  /**
   * Sets up the message listener for incoming messages
   */
  private setupMessageListener() {
    window.addEventListener("message", this.handleIncomingMessage.bind(this));
  }

  /**
   * Handles incoming messages and dispatches them to appropriate handlers
   */
  private async handleIncomingMessage(event: MessageEvent) {
    try {
      if (event.source == this.ehrWindow) return; // Ignore messages from the same window
      const message = event.data as RequestMessage;

      // Validate message structure
      if (!message || typeof message !== "object") {
        return;
      }

      // Check if message is for this messaging handle
      if (message.messagingHandle !== this.params.handle) {
        console.debug(
          `Ignoring message for handle '${message.messagingHandle}', expected '${this.params.handle}'`,
        );
        return;
      }
      if (!("messageType" in message)) return;

      // Check if we have a handler for this message type
      const messageType = message.messageType as RequestMessageType;
      const handler = this._handlers.get(messageType);
      if (handler) {
        console.debug(`Dispatching message of type: ${messageType}`);
        const result = await handler(message);
        if (result && typeof result === "object") {
          // If the handler returns a response, send it back
          const responseMsg: ResponseMessage = {
            messageId: SMARTWebMessagingConnector.generateMessageId(),
            responseToMessageId: message.messageId,
            payload: result as Record<string, unknown>,
            additionalResponseExpected: false, // Set to true if more responses are expected
          };
          this.postMessage(responseMsg);
        }
      } else {
        console.debug(
          `No handler registered for message type: ${messageType}`,
          this._handlers,
        );
      }
    } catch (error) {
      console.error("Error handling incoming message:", error);
    }
  }

  /**
   * Handles incoming messages of a specific type
   * @param messageType The type of message to handle
   * @param handler The function to call when a message of the specified type is received
   */
  public on<TMessageType extends RequestMessageType>(
    messageType: TMessageType,
    handler: (
      message: RequestMessage & { messageType: TMessageType },
    ) => unknown,
  ) {
    console.debug(`Registering handler for message type: ${messageType}`);
    this._handlers.set(messageType, handler as MessageHandler);
  }

  /**
   * Removes a handler for a specific message type
   * @param messageType The type of message to stop handling
   * @returns true if a handler was removed, false if no handler was found
   */
  public removeHandler(messageType: RequestMessageType): boolean {
    return this._handlers.delete(messageType);
  }

  /**
   * Checks if a handler is registered for a specific message type
   * @param messageType The type of message to check
   * @returns true if a handler is registered, false otherwise
   */
  public hasHandler(messageType: RequestMessageType): boolean {
    return this._handlers.has(messageType);
  }

  /**
   * Gets all registered message types
   * @returns An array of all message types that have handlers
   */
  public getRegisteredMessageTypes(): RequestMessageType[] {
    return Array.from(this._handlers.keys());
  }

  /**
   * Gets the count of registered handlers
   * @returns The number of registered message handlers
   */
  public getHandlerCount(): number {
    return this._handlers.size;
  }

  async connect() {
    if (this.status == "connecting" && this._pendingHandshake) {
      return await this._pendingHandshake;
    }
    console.debug("Establishing connection.");
    this.setStatus("connecting");
    this._pendingHandshake = withTimeout(
      this.sendMessage("status.handshake"),
      this.options.timeoutMs,
    )
      .then(() => {
        this.setStatus("connected");
        console.debug("Connection established.");
      })
      .catch((reason) => {
        if (this.status !== "connecting") return;
        this.setStatus("error");
        throw reason;
      });
    await this._pendingHandshake;
  }

  async connectWithRetry() {
    let retries = 0;
    while (retries < this.options.maxRetries) {
      console.debug(`Attempt ${retries + 1} to connect`);
      try {
        await this.connect();
        return;
      } catch (error) {
        console.debug("Failed to initialize connection:", error);
      }
      retries++;
    }
    throw new Error(
      `Failed to establish connection after ${this.options.maxRetries} retries`,
    );
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
  private cleanup() {
    window.removeEventListener("message", this.handleIncomingMessage);
    this._listeners.statusChange.clear();
    this._handlers.clear();
  }

  static buildFromWindow(window: Window, params: SMARTMessagingParams) {
    const ehrWindow =
      window.parent !== window.self
        ? window.parent
        : (window.opener ?? window.chrome?.webview ?? window.parent);
    return new SMARTWebMessagingConnector(
      ehrWindow,
      {
        handle: params.handle,
        origin: params.origin ?? ehrWindow?.location?.window,
      },
      {
        timeoutMs: 1000,
        maxRetries: 3,
      },
    );
  }
}
