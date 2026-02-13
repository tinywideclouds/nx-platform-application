import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import {
  DriverCapabilities,
  VaultProvider,
  VaultDrivers,
  AssetResult,
} from '@nx-platform-application/platform-infrastructure-storage';
import { AssetStorageService } from '@nx-platform-application/messenger-infrastructure-asset-storage';
import { ConversationMessagingService } from '@nx-platform-application/messenger-domain-conversation';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import {
  MessageContentParser,
  AssetRevealData,
  ImageContent,
} from '@nx-platform-application/messenger-domain-message-content';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { ImageProcessingService } from '@nx-platform-application/platform-tools-image-processing';
import { ActiveChatFacade } from '@nx-platform-application/messenger-state-active-chat';

const driveImage = 'driveImage';

@Injectable({ providedIn: 'root' })
export class ChatMediaFacade {
  private readonly logger = inject(Logger);
  private readonly assetStorage = inject(AssetStorageService);
  private readonly conversationMessaging = inject(ConversationMessagingService);
  private readonly storageServiceDb = inject(ChatStorageService);
  private readonly parser = inject(MessageContentParser);
  private readonly activeChat = inject(ActiveChatFacade);
  private readonly storageServiceInfra = inject(StorageService);
  private readonly imageProcessor = inject(ImageProcessingService);
  private drivers = inject(VaultDrivers);

  private getDriver(providerId: string): VaultProvider | undefined {
    return this.drivers.find((d) => d.providerId === providerId);
  }

  public getCapabilities(providerId: string): DriverCapabilities {
    const driver = this.getDriver(providerId);
    return driver
      ? driver.capabilities
      : {
          canDownload: false,
          canEmbed: false,
          canLinkExternal: false,
        };
  }

  async getEmbedLink(providerId: string, resourceId: string): Promise<string> {
    const driver = this.getDriver(providerId);
    if (!driver || !driver.capabilities.canEmbed)
      throw new Error('Embed not supported');
    return driver.getEmbedLink(resourceId);
  }

  async getDriveLink(providerId: string, resourceId: string): Promise<string> {
    const driver = this.getDriver(providerId);
    if (!driver || !driver.capabilities.canLinkExternal)
      throw new Error('Embed not supported');
    return driver.getDriveLink(resourceId);
  }

  async getDownload(providerId: string, resourceId: string): Promise<string> {
    const driver = this.getDriver(providerId);
    if (!driver || !driver.capabilities.canDownload)
      throw new Error('Embed not supported');
    return driver.downloadAsset(resourceId);
  }

  public async sendImage(
    recipient: URN,
    file: File,
    caption: string | undefined,
  ): Promise<void> {
    const isConnected = this.storageServiceInfra.isConnected();
    this.logger.info(
      `[MediaFacade] Processing image. Connected: ${isConnected}`,
    );

    try {
      const bitmap = await createImageBitmap(file);
      const metadata = {
        width: bitmap.width,
        height: bitmap.height,
        sizeBytes: file.size,
        mimeType: file.type,
        displayName: file.name,
      };
      bitmap.close();

      const inlineBlob = await this.imageProcessor.resize(file, {
        width: 64,
        quality: 0.7,
        format: 'image/png',
      });
      const base64 = await this.imageProcessor.toBase64(inlineBlob);

      const payload: ImageContent = {
        kind: 'image',
        inlineImage: base64,
        assets: undefined,
        decryptionKey: undefined,
        caption,
        ...metadata,
      };

      // ✅ FIX: Destructure ID from the returned ChatMessage object
      const message = await this.conversationMessaging.sendImage(
        recipient,
        payload,
      );
      const messageId = message.id;

      this.logger.info(
        `[MediaFacade] Sent inline image. Message ID: ${messageId}`,
      );

      if (isConnected) {
        this.processBackgroundUpload(
          recipient,
          messageId, // correctly passing string
          file,
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
    mediaMapId: string,
  ): Promise<void> {
    this.logger.info(
      `[MediaFacade] Starting background upload for ${messageId}`,
    );

    try {
      const result = await this.assetStorage.upload(file);
      const assets: Record<string, AssetResult> = { [mediaMapId]: result };

      const signalData: AssetRevealData = {
        messageId,
        assets,
      };

      await this.conversationMessaging.sendAssetReveal(recipient, signalData);
      await this.patchLocalMessage(messageId, signalData);

      // Refresh UI via ActiveChatFacade
      await this.activeChat.refreshMessages([messageId]);

      this.logger.info(`[MediaFacade] Upload complete for ${messageId}`);
    } catch (e) {
      this.logger.error(`[MediaFacade] Error during background upload flow`, e);
      throw e;
    }
  }

  async upgradeInlineImage(messageId: string, sourceBlob: Blob): Promise<void> {
    try {
      const resizedBlob = await this.imageProcessor.resize(sourceBlob, {
        width: 720,
        format: 'image/png',
        quality: 0.85,
      });

      const base64 = await this.imageProcessor.toBase64(resizedBlob);

      await this.patchLocalMessage(messageId, {
        inlineImage: base64,
      });

      await this.activeChat.refreshMessages([messageId]);
    } catch (e) {
      console.error('[ChatFacade] Failed to upgrade thumbnail', e);
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
