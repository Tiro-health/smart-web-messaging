/**
 * WebView2 Type Declarations
 * Reference: https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/javascript
 *
 * The following types correspond to methods necessary for communication between the host and browser for the Microsoft Edge WebView2 applications.
 */

interface WebViewEventListenerObject {
  handleEvent(object: MessageEvent): void;
}

interface WebViewEventListener {
  (evt: MessageEvent): void;
}

/**
 * WebView2 augments the standard DOM event listener event with an additional data field. This field
 * contains any JSON encoded passed from the host via PostWebMessageAsJson.
 * See https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2?view=webview2-1.0.1722.45#postwebmessageasjson
 */
type WebViewEventListenerOrEventListenerObject = WebViewEventListener;

/**
 * window.chrome.webview is the class to access the WebView2-specific APIs that are available
 * to the script running within WebView2 Runtime.
 */
export interface WebView extends EventTarget {
  /**
   * The standard EventTarget.addEventListener method. Use it to subscribe to the message event
   * or sharedbufferreceived event. The message event receives messages posted from the WebView2
   * host via CoreWebView2.PostWebMessageAsJson or CoreWebView2.PostWebMessageAsString. The
   * sharedbufferreceived event receives shared buffers posted from the WebView2 host via
   * CoreWebView2.PostSharedBufferToScript.
   * See CoreWebView2.PostWebMessageAsJson( Win32/C++, .NET, WinRT).
   * @param type The name of the event to subscribe to. Valid values are message, and sharedbufferreceived.
   * @param listener The callback to invoke when the event is raised.
   * @param options Options to control how the event is handled.
   */
  addEventListener(
    type: "message",
    listener: WebViewEventListener,
    options?: boolean | AddEventListenerOptions,
  ): void;

  /**
   * When the page calls postMessage, the message parameter is converted to JSON and is posted
   * asynchronously to the WebView2 host process. This will result in either the
   * CoreWebView2.WebMessageReceived event or the CoreWebView2Frame.WebMessageReceived event being
   * raised, depending on if postMessage is called from the top-level document in the WebView2
   * or from a child frame. See CoreWebView2.WebMessageReceived( Win32/C++, .NET, WinRT).
   * See CoreWebView2Frame.WebMessageReceived( Win32/C++, .NET, WinRT).
   * @param message The message to send to the WebView2 host. This can be any object that can be
   *                serialized to JSON.
   */
  postMessage(message: unknown): void;

  /**
   * The standard EventTarget.removeEventListener method. Use it to unsubscribe to the message
   * or sharedbufferreceived event.
   * @param type The name of the event to unsubscribe from. Valid values are message and sharedbufferreceived.
   * @param listener The callback to remove from the event.
   * @param options Options to control how the event is handled.
   */
  removeEventListener(
    type: string,
    listener: WebViewEventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

// Global object
declare global {
  interface Window {
    chrome: {
      webview: WebView;
    };
  }
}
