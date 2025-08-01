# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build System

- Build TypeScript: `tsc` (no npm scripts configured)
- Output directory: `dist/` (CommonJS modules)
- TypeScript config: Uses CommonJS target ES6 with declarations

## Architecture

This is a SMART Web Messaging SDK that enables secure communication between web applications and EHR systems. The main architecture consists of:

### Core Components

- `SMARTWebMessagingConnector`: Main class handling bidirectional messaging with retry logic and connection management
- Connection states: `connecting`, `connected`, `disconnected`, `error`
- Message types: `form.requestSubmit`, `form.checkValidity`, `form.persist`, `status.handshake`, `ui.close`

### Key Patterns

- **Handshake Protocol**: Uses `status.handshake` message type for connection establishment
- **Message Routing**: Messages routed by `messagingHandle` and `messageType`
- **Event-driven**: Uses addEventListener/removeEventListener pattern for status changes
- **Timeout/Retry**: Configurable timeouts (default 500ms) and retries (default 3)
- **Window Detection**: Auto-detects parent/opener/webview windows via `buildFromWindow`

### Message Flow

1. Connector sends messages with unique messageId and messagingHandle
2. Responses matched by responseToMessageId
3. Handlers registered via `on(messageType, handler)` for incoming messages
4. Supports multi-part responses via `additionalResponseExpected` flag

## Important Notes

- Library exports `SMARTWebMessagingConnector` as default export
- Supports WebView2 integration (see webview2.d.ts)
- All communication is PostMessage-based with origin validation
- Connection must be established before sending messages via `ensureConnection()`