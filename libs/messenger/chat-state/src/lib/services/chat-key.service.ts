// libs/messenger/chat-state/src/lib/services/chat-key.service.ts

import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { URN } from '@nx-platform-application/platform-types';

// Services
import { ContactsStorageService } from '@nx-platform-application/contacts-access';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';

@Injectable({ providedIn: 'root' })
export class ChatKeyService {
  private logger = inject(Logger);
  private contactsService = inject(ContactsStorageService);
  private keyService = inject(KeyCacheService);
  private cryptoService = inject(MessengerCryptoService);

  /**
   * Resolves a generic Contact URN to a specific actionable Identity URN.
   * Resolution Order:
   * 1. If already an Auth/Lookup URN, return as is.
   * 2. Check for explicitly Linked Identities (from a handshake).
   * 3. Email Discovery: Use the contact's email to construct a Lookup URN.
   * 4. Fallback to original URN.
   */
  public async resolveRecipientIdentity(urn: URN): Promise<URN> {
    // 1. Passthrough if already specific
    if (
      urn.toString().startsWith('urn:auth:') ||
      urn.toString().startsWith('urn:lookup:')
    ) {
      return urn;
    }

    // 2. Check Linked Identities (Handshake results)
    const identities = await this.contactsService.getLinkedIdentities(urn);
    if (identities.length > 0) {
      return identities[0];
    }

    // 3. Email Discovery Fallback
    const contact = await this.contactsService.getContact(urn);

    // FIX: Check primary 'email' property first (from User interface), then the array
    const email = contact?.email || contact?.emailAddresses?.[0];

    if (email) {
      const lookupUrn = URN.create('email', email, 'lookup');
      this.logger.debug(
        `Resolved Contact ${urn} to Lookup Handle: ${lookupUrn}`
      );
      return lookupUrn;
    }

    // 4. Fallback
    return urn;
  }

  /**
   * Checks if valid public keys exist for a recipient.
   * Handles identity resolution automatically.
   * @returns true if keys exist, false otherwise.
   */
  public async checkRecipientKeys(urn: URN): Promise<boolean> {
    // Groups handle keys differently (not checked here)
    if (urn.entityType !== 'user') {
      return true;
    }

    try {
      const targetUrn = await this.resolveRecipientIdentity(urn);

      // This will now query /api/keys/urn:lookup:email:bob@gmail.com
      // instead of the local ID, solving the 404.
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
      const handleUrn = URN.create('email', userEmail, 'lookup');
      this.logger.info(`Re-claiming public handle: ${handleUrn.toString()}`);
      await this.keyService.storeKeys(handleUrn, result.publicKeys);
    }

    return result.privateKeys;
  }
}
