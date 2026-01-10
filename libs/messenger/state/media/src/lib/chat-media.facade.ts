import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { AssetStorageService } from '@nx-platform-application/messenger-infrastructure-asset-storage';
import {
  ConversationService,
  ConversationActionService,
} from '@nx-platform-application/messenger-domain-conversation';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import {
  MessageContentParser,
  AssetRevealData,
} from '@nx-platform-application/messenger-domain-message-content';

@Injectable({ providedIn: 'root' })
export class ChatMediaFacade {
  private readonly logger = inject(Logger);
  private readonly assetStorage = inject(AssetStorageService);
  private readonly conversationService = inject(ConversationService);
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
        `[MediaFacade] Starting background upload for ${messageId}`,
      );

      console.log('starting media upload');
      // 1. Upload
      const storedAsset = await this.assetStorage.upload(file);

      // 2. Signal
      const signalData: AssetRevealData & { originalUrl?: string } = {
        messageId,
        remoteUrl: storedAsset.inlineUrl, // The "Polite" URL
        originalUrl: storedAsset.originalUrl, // The "Archival" URL
      };

      await this.conversationActions.sendAssetReveal(
        recipient,
        signalData,
        keys,
        sender,
      );

      // 3. Local Patch
      await this.patchLocalMessage(messageId, {
        remoteUrl: storedAsset.inlineUrl,
        originalUrl: storedAsset.originalUrl,
      });

      // 4. ✅ NEW: Trigger UI Refresh
      // The local DB is updated, but the UI signal is stale. Force a reload.
      await this.conversationService.reloadMessages([messageId]);

      this.logger.info(
        `[MediaFacade] Upload complete & UI refreshed for ${messageId}`,
      );
    } catch (err) {
      this.logger.error('[MediaFacade] Upload failed', err);
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
