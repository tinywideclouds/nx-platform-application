import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';

import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';

@Injectable({ providedIn: 'root' })
export class ChatKeyService {
  private logger = inject(Logger);
  private keyService = inject(KeyCacheService);
  private identityResolver = inject(IdentityResolver);

  // 🗑️ REMOVED: private cryptoService = inject(PrivateKeyService);
  // This service no longer manages the current user's private identity.

  /**
   * Checks if valid public keys exist for a recipient.
   * Handles identity resolution automatically via the Adapter.
   *
   * @param urn The generic URN (e.g., 'urn:contacts:user:alice')
   * @returns true if keys exist in cache/network
   */
  public async checkRecipientKeys(urn: URN): Promise<boolean> {
    // We only check keys for users, not groups (which have different key distribution)
    if (urn.entityType !== 'user') {
      return true;
    }

    try {
      // 1. Resolve Contact -> Handle (e.g. email URN)
      const targetUrn = await this.identityResolver.resolveToHandle(urn);

      // 2. Check Cache/Network for keys
      const hasKeys = await this.keyService.hasKeys(targetUrn);

      if (!hasKeys) {
        this.logger.warn(
          `[ChatKeyService] Recipient ${urn} (Target: ${targetUrn}) is missing public keys.`,
        );
      }
      return hasKeys;
    } catch (e) {
      this.logger.error('[ChatKeyService] Failed to check recipient keys', e);
      return false; // Fail safe: Assume no keys if check errors
    }
  }
}
