import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { URN } from '@nx-platform-application/platform-types';

// Services
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';

// TODO: Phase 2.1 - We will move this class into this library next.
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';

@Injectable({ providedIn: 'root' })
export class ChatKeyService {
  private logger = inject(Logger);
  private keyService = inject(KeyCacheService);
  private cryptoService = inject(MessengerCryptoService);
  private identityResolver = inject(IdentityResolver);

  /**
   * Checks if valid public keys exist for a recipient.
   * Handles identity resolution automatically via the Adapter.
   */
  public async checkRecipientKeys(urn: URN): Promise<boolean> {
    if (urn.entityType !== 'user') {
      return true;
    }

    try {
      // 1. Resolve Contact -> Handle
      const targetUrn = await this.identityResolver.resolveToHandle(urn);

      // 2. Check Cache/Network for keys
      const hasKeys = await this.keyService.hasKeys(targetUrn);

      if (!hasKeys) {
        this.logger.warn(
          `Recipient ${urn} (Target: ${targetUrn}) is missing public keys.`,
        );
      }
      return hasKeys;
    } catch (e) {
      this.logger.error('Failed to check recipient keys', e);
      return false; // Fail safe
    }
  }

  public async resetIdentityKeys(
    userUrn: URN,
    userEmail?: string,
  ): Promise<PrivateKeys> {
    this.logger.info('ChatKeyService: Resetting Identity Keys...');

    await this.cryptoService.clearKeys();

    const result = await this.cryptoService.generateAndStoreKeys(userUrn);

    if (userEmail) {
      const handleUrn = URN.create('email', userEmail, 'lookup');
      this.logger.info(`Re-claiming public handle: ${handleUrn.toString()}`);
      await this.keyService.storeKeys(handleUrn, result.publicKeys);
    }

    return result.privateKeys;
  }
}
