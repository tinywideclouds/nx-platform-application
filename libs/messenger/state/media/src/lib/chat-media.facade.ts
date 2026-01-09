import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { AssetStorageService } from '@nx-platform-application/messenger-infrastructure-asset-storage';
import { ConversationActionService } from '@nx-platform-application/messenger-domain-conversation';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import {
  MessageContentParser,
  AssetRevealData,
} from '@nx-platform-application/messenger-domain-message-content';

@Injectable({ providedIn: 'root' })
export class ChatMediaFacade {
  private readonly logger = inject(Logger);
  private readonly assetStorage = inject(AssetStorageService);
  private readonly conversationActions = inject(ConversationActionService);
  private readonly storageService = inject(ChatStorageService);
  private readonly parser = inject(MessageContentParser);

  public async processBackgroundUpload(
    recipient: URN,
    messageId: string,
    file: File,
    keys: PrivateKeys,
    sender: URN,
  ): Promise<void> {
    try {
      this.logger.info(
        `[MediaFacade] Starting background upload for msg ${messageId}`,
      );

      // 1. Upload to Cloud
      const publicUrl = await this.assetStorage.upload(file);

      // 2. Send "Patch" Signal (Durable)
      const signalData: AssetRevealData = {
        messageId: messageId,
        remoteUrl: publicUrl,
      };

      await this.conversationActions.sendAssetReveal(
        recipient,
        signalData,
        keys,
        sender,
      );

      // 3. Update Local DB (so WE see the high-res too)
      await this.patchLocalMessage(messageId, { remoteUrl: publicUrl });

      this.logger.info(
        `[MediaFacade] Background upload complete for ${messageId}`,
      );
    } catch (err) {
      this.logger.error('[MediaFacade] Background upload failed', err);
    }
  }

  private async patchLocalMessage(
    messageId: string,
    updates: any,
  ): Promise<void> {
    const msg = await this.storageService.getMessage(messageId);
    if (!msg || !msg.payloadBytes) return;

    try {
      const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);
      if (parsed.kind === 'content') {
        const newPayload = { ...parsed.payload, ...updates };
        const newBytes = this.parser.serialize(newPayload);
        await this.storageService.updateMessagePayload(messageId, newBytes);
      }
    } catch (e) {
      this.logger.error(`[MediaFacade] Failed to patch local message`, e);
    }
  }
}
