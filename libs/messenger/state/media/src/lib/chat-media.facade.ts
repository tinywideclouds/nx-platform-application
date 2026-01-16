import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { AssetResult } from '@nx-platform-application/platform-infrastructure-storage';
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
  ImageContent,
} from '@nx-platform-application/messenger-domain-message-content';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { ImageProcessingService } from '@nx-platform-application/platform-tools-image-processing';

const driveImage = 'drive-image';

@Injectable({ providedIn: 'root' })
export class ChatMediaFacade {
  private readonly logger = inject(Logger);
  private readonly assetStorage = inject(AssetStorageService);
  private readonly conversationService = inject(ConversationService);
  private readonly conversationActions = inject(ConversationActionService);
  private readonly storageServiceDb = inject(ChatStorageService);
  private readonly parser = inject(MessageContentParser);

  // Logic Injections
  private readonly storageServiceInfra = inject(StorageService);
  private readonly imageProcessor = inject(ImageProcessingService);

  public async sendImage(
    recipient: URN,
    file: File,
    caption: string | undefined,
    keys: PrivateKeys,
    sender: URN,
  ): Promise<void> {
    const isConnected = this.storageServiceInfra.isConnected();
    this.logger.info(
      `[MediaFacade] Processing image. Connected: ${isConnected}`,
    );

    try {
      // 1. Calculate Original Metadata
      const bitmap = await createImageBitmap(file);
      const metadata = {
        width: bitmap.width,
        height: bitmap.height,
        sizeBytes: file.size,
        mimeType: file.type,
        displayName: file.name,
      };
      bitmap.close();

      // 2. Generate "Chat Quality" Inline Image (Unified Path)
      const inlineBlob = await this.imageProcessor.resize(file, {
        width: 120,
        quality: 0.7,
        format: 'image/png',
      });
      const base64 = await this.imageProcessor.toBase64(inlineBlob);

      // 3. Construct Initial Payload
      const payload: ImageContent = {
        kind: 'image',
        inlineImage: base64, // <--- High Quality Inline (Immediate)
        assets: undefined, // <--- Pending Upload
        decryptionKey: undefined,
        caption,
        ...metadata,
      };

      // 4. Send Immediately
      const messageId = await this.conversationActions.sendImage(
        recipient,
        payload,
        keys,
        sender,
      );
      this.logger.info(
        `[MediaFacade] Sent inline image. Message ID: ${messageId}`,
      );

      // 5. Conditional Enrichment (Background Upload)
      if (isConnected) {
        // We upload the ORIGINAL file to preserve max quality in the Vault
        this.processBackgroundUpload(
          recipient,
          messageId,
          file,
          keys,
          sender,
          driveImage,
        ).catch((e) => {
          this.logger.error(
            `[MediaFacade] Background upload failed for ${messageId}`,
            e,
          );
        });
      }
    } catch (e) {
      this.logger.error('[MediaFacade] Failed to process image', e);
    }
  }

  private async processBackgroundUpload(
    recipient: URN,
    messageId: string,
    file: File,
    keys: PrivateKeys,
    sender: URN,
    mediaMapId: string,
  ): Promise<void> {
    this.logger.info(
      `[MediaFacade] Starting background upload for ${messageId}`,
    );

    try {
      // 1. Upload to Vault (Google/Dropbox/etc)
      // Expects AssetResult: { uploads: string[], provider: '...' }
      const result = await this.assetStorage.upload(file);

      const assets: Record<string, AssetResult> = { [mediaMapId]: result };
      // 3. Signal (Reveal) to Recipient
      // We send the ID (provider reference) so they can "Download" it later
      const signalData: AssetRevealData = {
        messageId,
        assets,
      };

      await this.conversationActions.sendAssetReveal(
        recipient,
        signalData,
        keys,
        sender,
      );

      // 4. Local Patch (Update our own DB to show "Open" button)
      await this.patchLocalMessage(messageId, signalData);

      // 5. UI Refresh
      await this.conversationService.reloadMessages([messageId]);

      this.logger.info(`[MediaFacade] Upload complete for ${messageId}`);
    } catch (e) {
      this.logger.error(`[MediaFacade] Error during background upload flow`, e);
      throw e;
    }
  }

  private async patchLocalMessage(
    messageId: string,
    updates: any,
  ): Promise<void> {
    const msg = await this.storageServiceDb.getMessage(messageId);
    if (!msg || !msg.payloadBytes) return;

    try {
      const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);
      if (parsed.kind === 'content') {
        const newPayload = { ...parsed.payload, ...updates };
        const newBytes = this.parser.serialize(newPayload);
        await this.storageServiceDb.updateMessagePayload(messageId, newBytes);
      }
    } catch (e) {
      this.logger.error(`[MediaFacade] Failed to patch local message`, e);
    }
  }
}
