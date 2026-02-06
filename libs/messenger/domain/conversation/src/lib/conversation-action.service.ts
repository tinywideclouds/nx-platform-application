import { Injectable, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import { Priority, URN } from '@nx-platform-application/platform-types';
import {
  OutboundService,
  SendOptions,
} from '@nx-platform-application/messenger-domain-sending';
import {
  MessageTypingIndicator,
  ReadReceiptData,
  ContactShareData,
  ImageContent,
  TextContent,
  MessageTypeText,
  MessageTypeImage,
  MessageTypeReadReceipt,
  AssetRevealData,
  MessageTypeAssetReveal,
  MessageTypeContactShare,
  ContentPayload,
  RichContent,
} from '@nx-platform-application/messenger-domain-message-content';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';

@Injectable({ providedIn: 'root' })
export class ConversationActionService {
  private outbound = inject(OutboundService);
  private storage = inject(ChatStorageService);
  private destroyRef = inject(DestroyRef);
  private operationLock = Promise.resolve();

  // Signals
  private readonly _readReceiptsSent = new Subject<URN>();
  public readonly readReceiptsSent$ = this._readReceiptsSent.asObservable();

  // --- Optimization: Batching ---
  private pendingReadReceipts = new Map<string, Set<string>>();
  private readTrigger$ = new Subject<void>();
  private readonly READ_BATCH_TIME_MS = 1000;

  // --- Optimization: Throttling ---
  private lastTypingSentTime = 0;
  private readonly TYPING_THROTTLE_MS = 3000;

  constructor() {
    // Modern Reactive Setup:
    // Auto-unsubscribes when the service/context is destroyed.
    this.readTrigger$
      .pipe(auditTime(this.READ_BATCH_TIME_MS), takeUntilDestroyed())
      .subscribe(() => {
        this.flushReadReceipts();
      });

    // Ensure flush on destroy (edge case safety)
    this.destroyRef.onDestroy(() => this.flushReadReceipts());
  }

  /**
   * Sends a text message. Returns the optimistic message object for UI updates.
   */
  async sendMessage(recipientUrn: URN, text: string): Promise<ChatMessage> {
    this.lastTypingSentTime = 0; // Reset throttle immediately

    const payload: TextContent = { kind: 'text', text };
    const typeId = MessageTypeText;
    return await this.sendGeneric(recipientUrn, typeId, payload);
  }

  async sendImage(
    recipientUrn: URN,
    content: ImageContent,
  ): Promise<ChatMessage> {
    const typeId = MessageTypeImage;
    return await this.sendGeneric(recipientUrn, typeId, content);
  }

  async sendContactShare(
    recipientUrn: URN,
    data: ContactShareData,
  ): Promise<ChatMessage> {
    const payload: RichContent = {
      kind: 'rich',
      subType: 'contact-share',
      data: data,
    };
    const typeId = MessageTypeContactShare;
    return await this.sendGeneric(recipientUrn, typeId, payload);
  }

  async sendTypingIndicator(recipientUrn: URN): Promise<void> {
    const now = Date.now();
    // Efficient leading-edge throttle.
    // We use imperative check here to avoid overhead of creating RxJS objects
    // for every single keystroke.
    if (now - this.lastTypingSentTime < this.TYPING_THROTTLE_MS) {
      return;
    }
    this.lastTypingSentTime = now;

    const typeId = MessageTypingIndicator;
    const bytes = new Uint8Array([]);

    // Fire & Forget (don't block UI)
    this.runExclusive(() =>
      this.outbound.sendFromConversation(recipientUrn, typeId, bytes, {
        isEphemeral: true,
        shouldPersist: false,
      }),
    ).catch((err) => {
      // Silent catch for background indicators
    });
  }

  public async markMessagesAsRead(
    conversationUrn: URN,
    messageIds: string[],
  ): Promise<void> {
    if (messageIds.length === 0) return;

    // 1. Optimistic Update (Immediate)
    await this.storage.markMessagesAsRead(conversationUrn, messageIds);

    // 2. Queue for Network
    const key = conversationUrn.toString();
    if (!this.pendingReadReceipts.has(key)) {
      this.pendingReadReceipts.set(key, new Set());
    }
    const currentSet = this.pendingReadReceipts.get(key)!;
    messageIds.forEach((id) => currentSet.add(id));

    // 3. Trigger Reactive Batch
    this.readTrigger$.next();
  }

  private async flushReadReceipts() {
    for (const [urnStr, idSet] of this.pendingReadReceipts.entries()) {
      if (idSet.size === 0) continue;

      const urn = URN.parse(urnStr);
      const ids = Array.from(idSet);
      this.pendingReadReceipts.delete(urnStr);

      try {
        await this.sendReadReceiptSignal(urn, ids);
        this._readReceiptsSent.next(urn);
      } catch (err) {
        // Log error but don't crash the loop
      }
    }
  }

  private async sendReadReceiptSignal(
    conversationUrn: URN,
    messageIds: string[],
  ): Promise<void> {
    const data: ReadReceiptData = {
      messageIds,
      readAt: new Date().toISOString(),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const typeId = MessageTypeReadReceipt;

    await this.sendGeneric(conversationUrn, typeId, bytes, {
      shouldPersist: false,
      priority: Priority.High,
    });
  }

  async sendAssetReveal(
    recipientUrn: URN,
    data: AssetRevealData,
  ): Promise<void> {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const typeId = MessageTypeAssetReveal;
    await this.sendGeneric(recipientUrn, typeId, bytes, {
      shouldPersist: false,
    });
  }

  private async sendGeneric(
    recipientUrn: URN,
    typeId: URN,
    content: ContentPayload | Uint8Array,
    options?: SendOptions,
  ): Promise<ChatMessage> {
    return this.runExclusive(async () => {
      const result = await this.outbound.sendFromConversation(
        recipientUrn,
        typeId,
        content,
        options,
      );

      if (result) {
        return result.message;
      }
      throw new Error('Send failed');
    });
  }

  private async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previousLock = this.operationLock;
    let releaseLock: () => void;
    this.operationLock = new Promise((resolve) => {
      releaseLock = resolve;
    });
    try {
      await previousLock;
      return await task();
    } finally {
      releaseLock!();
    }
  }
}
