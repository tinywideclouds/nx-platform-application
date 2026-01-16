import { Injectable } from '@angular/core';
import { Subject, of, Observable } from 'rxjs';
import {
  QueuedMessage,
  ConnectionStatus,
  SecureEnvelope,
} from '@nx-platform-application/platform-types';
import { TransportMessage } from '@nx-platform-application/messenger-types';
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/messenger-infrastructure-chat-access';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

/**
 * Mocks the "Pull" API (Router).
 */
@Injectable()
export class MockChatDataService implements Partial<ChatDataService> {
  private queue: QueuedMessage[] = [];

  // --- Test Helper ---
  public enqueue(msg: QueuedMessage): void {
    this.queue.push(msg);
  }

  // --- API ---
  public getMessageBatch(limit: number): Observable<QueuedMessage[]> {
    const batch = this.queue.slice(0, limit);
    return of(batch);
  }

  public acknowledge(ids: string[]): Observable<void> {
    this.queue = this.queue.filter((m) => !ids.includes(m.id));
    return of(undefined);
  }
}

/**
 * Mocks the "Push" API (Sending).
 */
@Injectable()
export class MockChatSendService implements Partial<ChatSendService> {
  public readonly sentMessages: SecureEnvelope[] = [];

  // --- API ---
  public sendMessage(envelope: SecureEnvelope): Observable<void> {
    console.log('[MockSend] 🚀 Message Sent:', envelope);
    this.sentMessages.push(envelope);
    return of(undefined);
  }
}

/**
 * Mocks the WebSocket (Status & Pokes).
 */
@Injectable()
export class MockLiveService implements Partial<ChatLiveDataService> {
  public readonly incomingMessage$ = new Subject<void>();
  public readonly status$ = new Subject<ConnectionStatus>();

  // --- API ---
  public connect(tokenProvider: () => string): void {
    console.log('[MockLive] 🟢 Connected');
    setTimeout(() => this.status$.next('connected'), 50);
  }

  public disconnect(): void {
    console.log('[MockLive] 🔴 Disconnected');
    this.status$.next('disconnected');
  }

  // --- Test Helper ---
  public triggerPoke(): void {
    console.log('[MockLive] 👉 Poke!');
    this.incomingMessage$.next();
  }
}
