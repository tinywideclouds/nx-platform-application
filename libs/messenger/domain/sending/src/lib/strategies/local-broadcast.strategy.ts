import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ChatStorageService,
  OutboxStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import {
  MessageDeliveryStatus,
  OutboundTask,
} from '@nx-platform-application/messenger-types';
import { SendStrategy, SendContext } from './send-strategy.interface';
import { OutboundResult } from '../outbound.service';

@Injectable({ providedIn: 'root' })
export class LocalBroadcastStrategy implements SendStrategy {
  private logger = inject(Logger);
  private storageService = inject(ChatStorageService);
  private contactsApi = inject(ContactsQueryApi);
  private metadataService = inject(MessageMetadataService);
  private outboxStorage = inject(OutboxStorage);
  private outboxWorker = inject(OutboxWorkerService);

  async send(ctx: SendContext): Promise<OutboundResult> {
    const { myKeys, myUrn, recipientUrn, optimisticMsg, isEphemeral } = ctx;

    const outcomePromise = (async () => {
      try {
        const participants =
          await this.contactsApi.getGroupParticipants(recipientUrn);

        // ✅ 1:1 Simulation
        // We iterate and create a unique task for each person.
        // The Conversation Context is "1:1 with Sender" (myUrn).

        const tasks: Promise<void>[] = participants.map(async (p) => {
          const finalPayload = isEphemeral
            ? optimisticMsg.payloadBytes || new Uint8Array([])
            : this.metadataService.wrap(
                optimisticMsg.payloadBytes || new Uint8Array([]),
                myUrn, // Context is ME (Direct Message)
                optimisticMsg.tags || [],
              );

          const task: OutboundTask = {
            id: crypto.randomUUID(),
            messageId: `${optimisticMsg.id}-${p.id.toString()}`,
            conversationUrn: p.id, // Destination is the User
            typeId: optimisticMsg.typeId,
            payload: finalPayload,
            tags: optimisticMsg.tags || [],
            status: 'queued',
            createdAt: optimisticMsg.sentTimestamp,
            recipients: [
              {
                urn: p.id,
                status: 'pending',
                attempts: 0,
              },
            ],
          };
          await this.outboxStorage.addTask(task);
        });

        await Promise.all(tasks);
        this.outboxWorker.processQueue(myUrn, myKeys);

        return 'sent' as MessageDeliveryStatus;
      } catch (err) {
        this.logger.error('[LocalBroadcastStrategy] Failed', err);
        if (!isEphemeral) {
          await this.storageService.updateMessageStatus(
            [optimisticMsg.id],
            'failed',
          );
        }
        return 'failed' as MessageDeliveryStatus;
      }
    })();

    return { message: optimisticMsg, outcome: outcomePromise };
  }
}
