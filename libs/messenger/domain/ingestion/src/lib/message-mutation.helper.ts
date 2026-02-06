import { Injectable, inject } from '@angular/core';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { AssetRevealData } from '@nx-platform-application/messenger-domain-message-content';

@Injectable({ providedIn: 'root' })
export class MessageMutationHelper {
  private storageService = inject(ChatStorageService);
  private parser = inject(MessageContentParser);
  private logger = inject(Logger);

  /**
   * Applies an Asset Reveal patch to an existing message.
   * Performs a safe Fetch -> Merge -> Update cycle.
   */
  public async applyAssetReveal(
    patch: AssetRevealData,
  ): Promise<string | null> {
    const msg = await this.storageService.getMessage(patch.messageId);

    // Safety Checks: Message must exist and have content
    if (!msg || !msg.payloadBytes) return null;

    try {
      const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);

      // We can only patch 'content' messages
      if (parsed.kind !== 'content') return null;

      // MERGE LOGIC
      const newPayload = {
        ...parsed.payload,
        assets: patch.assets,
      };

      // Serialize & Save
      const newBytes = this.parser.serialize(newPayload);
      await this.storageService.updateMessagePayload(patch.messageId, newBytes);

      return patch.messageId;
    } catch (e) {
      this.logger.error(
        `[MutationHelper] Failed to patch message ${patch.messageId}`,
        e,
      );
      return null;
    }
  }

  // Future mutators (e.g. Edit Text) can go here...
}
