import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { AddressBookApi } from '@nx-platform-application/contacts-api';
import { ConversationService } from '@nx-platform-application/messenger-domain-conversation';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({ providedIn: 'root' })
export class ContactProtocolService {
  private logger = inject(Logger);
  private addressBook = inject(AddressBookApi);
  private conversationService = inject(ConversationService);

  /**
   * Ensures a 1:1 conversation session exists for this user.
   * Uses the Address Book to resolve a friendly name, falling back to defaults.
   */
  async ensureSession(senderUrn: URN): Promise<void> {
    const existing =
      await this.conversationService.conversationExists(senderUrn);
    if (existing) {
      return;
    }
    // 1. Check Address Book
    const contact = await this.addressBook.getContact(senderUrn);

    // 2. Resolve Display Name
    let displayName = 'Unknown User';

    if (contact && contact.alias) {
      displayName = contact.alias;
    } else {
      // Future: Could query Identity Service for public handle here
      // displayName = await this.identityService.getPublicAlias(senderUrn);
    }

    this.logger.info(
      `[ContactProtocol] Resolving session for ${senderUrn} as '${displayName}'`,
    );

    // 3. Uniform Initialization
    await this.conversationService.startNewConversation(senderUrn, displayName);
  }
}
