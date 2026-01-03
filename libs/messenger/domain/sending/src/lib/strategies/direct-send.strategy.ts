import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import {
  TransportMessage,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';
import { SendStrategy, SendContext } from './send-strategy.interface';
import { OutboundResult } from '../outbound.service';

@Injectable({ providedIn: 'root' })
export class DirectSendStrategy implements SendStrategy {
  private logger = inject(Logger);
  private sendService = inject(ChatSendService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private keyCache = inject(KeyCacheService);
  private identityResolver = inject(IdentityResolver);
  private metadataService = inject(MessageMetadataService);

  async send(ctx: SendContext): Promise<OutboundResult> {
    const { myKeys, myUrn, recipientUrn, optimisticMsg, isEphemeral } = ctx;

    const outcomePromise = (async () => {
      try {
        const targetRoutingUrn =
          await this.identityResolver.resolveToHandle(recipientUrn);
        const payloadSenderUrn =
          await this.identityResolver.resolveToHandle(myUrn);

        const transportPayloadBytes = isEphemeral
          ? optimisticMsg.payloadBytes || new Uint8Array([])
          : this.metadataService.wrap(
              optimisticMsg.payloadBytes || new Uint8Array([]),
              optimisticMsg.conversationUrn,
              optimisticMsg.tags || [],
            );

        const payload: TransportMessage = {
          senderId: payloadSenderUrn,
          sentTimestamp: optimisticMsg.sentTimestamp,
          typeId: optimisticMsg.typeId,
          payloadBytes: transportPayloadBytes,
          clientRecordId: isEphemeral ? undefined : optimisticMsg.id,
        };

        const recipientKeys =
          await this.keyCache.getPublicKey(targetRoutingUrn);

        const envelope = await this.cryptoService.encryptAndSign(
          payload,
          targetRoutingUrn,
          myKeys,
          recipientKeys,
        );

        if (isEphemeral) envelope.isEphemeral = true;

        await firstValueFrom(this.sendService.sendMessage(envelope));

        if (!isEphemeral) {
          await this.storageService.updateMessageStatus(
            [optimisticMsg.id],
            'sent',
          );
        }
        return 'sent' as MessageDeliveryStatus;
      } catch (err) {
        this.logger.error('[DirectStrategy] Failed', err);
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
