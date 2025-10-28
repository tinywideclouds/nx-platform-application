# 💬 libs/messenger/chat-live-data

This library handles the real-time, persistent connection for the chat system.

## 🎯 Purpose

The `ChatLiveDataService` is a "headless" service. Its **only** responsibility is to:
1.  Establish and maintain a WebSocket connection.
2.  Receive JSON-string messages from the socket.
3.  Parse the JSON string and use the `messenger-types` library to deserialize it into a `SecureEnvelope`.
4.  Expose the incoming `SecureEnvelope` objects on a public observable.
5.  Expose the connection status on a public observable.

This library **does not** contain any business logic. It does not know how to decrypt envelopes, manage application state, or handle connection fallbacks. That logic is the responsibility of the consumer (e.g., `chat-state`).

---

## 🚀 Public API

### `ChatLiveDataService`

Provided in `root`.

#### **`connect(url?: string): void`**
Establishes the connection to the WebSocket. If a `url` is not provided, it uses the hardcoded default.

#### **`disconnect(): void`**
Closes the WebSocket connection.

#### **`incomingMessage$: Observable<SecureEnvelope>`**
This is the primary output. It emits a `SecureEnvelope` for *any* message that arrives over the WebSocket, including chat messages, "is-typing" events, read receipts, etc.

The service itself does not inspect the content; it only deserializes and forwards the envelope.

#### **`status$: Observable<ConnectionStatus>`**
Emits the current state of the WebSocket connection. `ConnectionStatus` is one of:
* `'disconnected'`
* `'connecting'`
* `'connected'`
* `'error'`

This stream is crucial for consumers like `chat-state` to orchestrate UI and fallback logic (e.g., switching to HTTP polling).

---

## Example Usage

This is how the `chat-state` library would typically consume this service:

```typescript
import { Injectable, OnDestroy, inject } from '@angular/core';
import { ChatLiveDataService, ConnectionStatus } from '@nx-platform-application/chat-live-data';
import { ChatDataAccessService } from '@nx-platform-application/chat-data-access';
import { SecureEnvelope } from '@nx-platform-application/messenger-types';
import { Subject, Subscription, timer, switchMap, tap, catchError, EMPTY } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatStateService implements OnDestroy {
  private live = inject(ChatLiveDataService);
  private http = inject(ChatDataAccessService); // For fallback

  private subs = new Subscription();
  private isPolling = false;

  constructor() {
    this.connect();
  }

  connect(): void {
    // 1. Subscribe to incoming messages
    this.subs.add(
      this.live.incomingMessage$.subscribe((envelope) => {
        this.decryptAndProcessEnvelope(envelope);
      })
    );

    // 2. Subscribe to status to manage fallbacks
    this.subs.add(
      this.live.status$.subscribe((status) => {
        this.handleConnectionStatus(status);
      })
    );

    // 3. Initiate the connection
    this.live.connect();
  }

  private handleConnectionStatus(status: ConnectionStatus): void {
    if (status === 'connected') {
      this.isPolling = false;
    }
    
    // If we get an error or disconnect, start HTTP polling
    if ((status === 'error' || status === 'disconnected') && !this.isPolling) {
      this.isPolling = true;
      this.startHttpPolling();
    }
  }

  private startHttpPolling(): void {
    // Poll every 10 seconds, but only while 'isPolling' is true
    timer(0, 10000).pipe(
      tap(() => {
        if (!this.isPolling) throw new Error('Stop polling');
      }),
      switchMap(() => this.http.fetchNewMessagesSince(this.getLastMessageTimestamp())),
      catchError(() => {
        // Stop the timer
        return EMPTY;
      })
    ).subscribe(messages => {
      // Process polled messages...
    });
  }

  private decryptAndProcessEnvelope(envelope: SecureEnvelope): void {
    // ... decryption logic ...
    // ... logic to check if it's a 'typing' event or 'message' ...
    // ... update state ...
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.live.disconnect();
  }
}
