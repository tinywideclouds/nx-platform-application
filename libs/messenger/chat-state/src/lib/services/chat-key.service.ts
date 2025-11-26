import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { URN } from '@nx-platform-application/platform-types';

// Services
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';
import { ContactMessengerMapper } from './contact-messenger.mapper';

@Injectable({ providedIn: 'root' })
export class ChatKeyService {
  private logger = inject(Logger);
  private keyService = inject(KeyCacheService);
  private cryptoService = inject(MessengerCryptoService);
  private mapper = inject(ContactMessengerMapper);

  /**
   * Checks if valid public keys exist for a recipient.
   * Handles identity resolution automatically via the Mapper.
   * @returns true if keys exist, false otherwise.
   */
  public async checkRecipientKeys(urn: URN): Promise<boolean> {
    // Groups handle keys differently (not checked here)
    if (urn.entityType !== 'user') {
      return true;
    }

    try {
      // 1. Resolve Contact -> Handle
      // The mapper handles the "Identity Link" or "Email Discovery" logic
      const targetUrn = await this.mapper.resolveToHandle(urn);

      // 2. Check Cache/Network for keys
      // This now queries /api/keys/urn:lookup:email:bob@gmail.com
      const hasKeys = await this.keyService.hasKeys(targetUrn);

      if (!hasKeys) {
        this.logger.warn(
          `Recipient ${urn} (Target: ${targetUrn}) is missing public keys.`
        );
      }
      return hasKeys;
    } catch (e) {
      this.logger.error('Failed to check recipient keys', e);
      return false; // Fail safe
    }
  }

  /**
   * Performs the "Scorched Earth" reset of the current user's identity.
   */
  public async resetIdentityKeys(
    userUrn: URN,
    userEmail?: string
  ): Promise<PrivateKeys> {
    this.logger.info('ChatKeyService: Resetting Identity Keys...');

    await this.cryptoService.clearKeys();

    const result = await this.cryptoService.generateAndStoreKeys(userUrn);

    if (userEmail) {
      // Explicitly claim the Handle so discovery works immediately
      const handleUrn = URN.create('email', userEmail, 'lookup');
      this.logger.info(`Re-claiming public handle: ${handleUrn.toString()}`);
      await this.keyService.storeKeys(handleUrn, result.publicKeys);
    }

    return result.privateKeys;
  }
}