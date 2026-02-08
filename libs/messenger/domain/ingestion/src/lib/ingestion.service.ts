import { Injectable, inject } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { URN, QueuedMessage } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';

import { MessageClassifier } from './message-classifier.service';
import { MessageMutationHelper } from './message-mutation.helper';

export interface TypingIndicator {
  conversationId: URN;
  senderId: URN;
}

export interface IngestionResult {
  messages: ChatMessage[];
  typingIndicators: TypingIndicator[];
  readReceipts: string[];
  patchedMessageIds: string[];
}

@Injectable({ providedIn: 'root' })
export class IngestionService {
  private classifier = inject(MessageClassifier);
  private mutationHelper = inject(MessageMutationHelper);
  private dataService = inject(ChatDataService);
  private storageService = inject(ChatStorageService);
  private groupProtocol = inject(GroupProtocolService);
  private logger = inject(Logger);

  private readonly _dataIngested = new Subject<IngestionResult>();
  public readonly dataIngested$ = this._dataIngested.asObservable();

  private isRunning = false;

  public async process(blockedSet: Set<string>): Promise<void> {
    // 1. Concurrency Lock
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 2. The Drain Pipeline
      // Stream batches until the queue is empty.
      await firstValueFrom(
        this.dataService
          .getAllMessages()
          .pipe(concatMap((batch) => this.processBatch(batch, blockedSet))),
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async processBatch(
    batch: QueuedMessage[],
    blockedSet: Set<string>,
  ): Promise<void> {
    if (batch.length === 0) return;

    // --- STEP 1: CLASSIFY ---
    const intents = await Promise.all(
      batch.map((item) => this.classifier.classify(item, blockedSet)),
    );

    // --- STEP 2: SORT & BUCKET ---
    const typyingIndicators: TypingIndicator[] = [];
    const newMessages: ChatMessage[] = [];
    const receiptsToApply: Array<{ urn: URN; ids: string[] }> = [];
    const mutationsToRun: Array<any> = [];
    const acks: string[] = [];

    for (let i = 0; i < batch.length; i++) {
      const intent = intents[i];
      acks.push(batch[i].id); // Always ack consumed items

      switch (intent.kind) {
        case 'ephemeral':
          typyingIndicators.push({
            conversationId: intent.message.conversationId,
            senderId: intent.message.senderId,
          });
          break;
        case 'durable':
          newMessages.push(intent.message);
          break;
        case 'receipt':
          receiptsToApply.push({ urn: intent.urn, ids: intent.messageIds });
          break;
        case 'asset-reveal':
          mutationsToRun.push(intent.patch);
          break;
        case 'group-invite':
          await this.groupProtocol.processIncomingInvite(intent.data);
          break;
        case 'group-system': {
          const sysMsg = await this.groupProtocol.processSignal(
            intent.data,
            intent.sender,
            { messageId: intent.meta.id, sentAt: intent.meta.sentAt },
          );
          if (sysMsg) newMessages.push(sysMsg);
          break;
        }
      }
    }

    // --- STEP 3: FAST LANE (Fire & Forget) ---
    if (typyingIndicators.length > 0) {
      this.emitResult({ typingIndicators: typyingIndicators });
    }

    // --- STEP 4: DURABLE LANE (Store -> Notify) ---
    const hasDurableUpdates =
      newMessages.length > 0 ||
      receiptsToApply.length > 0 ||
      mutationsToRun.length > 0;

    if (hasDurableUpdates) {
      // A. Parallel Storage Operations
      // We do not use a transaction; we just ensure all writes complete.
      const tasks: Promise<any>[] = [];

      // 1. Insert New
      if (newMessages.length > 0) {
        tasks.push(this.storageService.bulkSaveMessages(newMessages));
      }

      // 2. Update Receipts
      for (const r of receiptsToApply) {
        for (const msgId of r.ids) {
          tasks.push(this.storageService.applyReceipt(msgId, r.urn, 'read'));
        }
      }

      // 3. Run Mutations (via Helper)
      const successfulPatches: string[] = [];
      for (const patch of mutationsToRun) {
        tasks.push(
          this.mutationHelper.applyAssetReveal(patch).then((id) => {
            if (id) successfulPatches.push(id);
          }),
        );
      }

      // Wait for ALL storage ops to finish
      await Promise.all(tasks);

      // B. Notify UI (The "Truth" Moment)
      this.emitResult({
        messages: newMessages,
        readReceipts: receiptsToApply.flatMap((r) => r.ids),
        patchedMessageIds: successfulPatches,
      });
    }

    // --- STEP 5: ACKNOWLEDGE ---
    await firstValueFrom(this.dataService.acknowledge(acks));
  }

  private emitResult(partial: Partial<IngestionResult>) {
    this._dataIngested.next({
      messages: [],
      typingIndicators: [],
      readReceipts: [],
      patchedMessageIds: [],
      ...partial,
    });
  }
}
