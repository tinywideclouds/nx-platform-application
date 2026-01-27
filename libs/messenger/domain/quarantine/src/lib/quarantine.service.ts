import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  ChatMessage,
} from '@nx-platform-application/messenger-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { QuarantineStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';

// ✅ CORRECT: Use the API Boundary, not State
import { AddressBookApi } from '@nx-platform-application/contacts-api';
// ✅ CORRECT: Use Directory for Block List & Group Roster checks
import { DirectoryQueryApi } from '@nx-platform-application/directory-api';

@Injectable({ providedIn: 'root' })
export class QuarantineService {
  private readonly storage = inject(QuarantineStorage);
  private readonly logger = inject(Logger);
  private readonly identityResolver = inject(IdentityResolver);
  private readonly metadataService = inject(MessageMetadataService);

  // ✅ Dependency Fix
  private readonly addressBook = inject(AddressBookApi);
  private readonly directory = inject(DirectoryQueryApi);

  async process(
    message: TransportMessage,
    blockedSet: Set<string>,
  ): Promise<URN | null> {
    const senderStr = message.senderId.toString();

    // 1. FAST FAIL: Explicitly Blocked (Directory/System Level)
    if (blockedSet.has(senderStr)) {
      this.logger.info(`[Gatekeeper] REJECTED: Blocked sender ${senderStr}`);
      return null;
    }

    // 2. Resolve Identity
    const canonicalUrn = await this.identityResolver.resolveToContact(
      message.senderId,
    );

    // 3. GOLDEN RULE: "In Contacts = Pre-approved"
    // We use the API to check the local Address Book.
    const contact = await this.addressBook.getContact(canonicalUrn);
    if (contact) {
      // ✅ ALLOW: Explicit Trust
      return canonicalUrn;
    }

    // 4. CONTEXTUAL TRUST: Group Membership
    // If not a contact, we check if they are a valid member of the target group.
    const { conversationId } = this.metadataService.unwrap(
      message.payloadBytes,
    );
    const isGroupMessage = conversationId?.entityType === 'group';

    if (isGroupMessage && conversationId) {
      // Check the Directory to see if they are on the roster
      const group = await this.directory.getGroup(conversationId);
      const isMember = group?.memberState[canonicalUrn.toString()] === 'joined';

      if (isMember) {
        // ✅ ALLOW: Implicit Trust (Group Peer)
        return canonicalUrn;
      }
    }

    // 5. FALLTHROUGH: Stranger Danger
    // - Unknown sender trying to DM.
    // - Unknown sender trying to post in a group they aren't in (spoofing).
    this.logger.info(`[Gatekeeper] DETAINED: Unknown sender ${senderStr}`);
    await this.storage.saveQuarantinedMessage(message);
    return null;
  }

  async getPendingRequests(): Promise<URN[]> {
    return this.storage.getQuarantinedSenders();
  }

  async retrieveForInspection(senderId: URN): Promise<ChatMessage[]> {
    return this.storage.getQuarantinedMessages(senderId);
  }

  async reject(senderId: URN): Promise<void> {
    await this.storage.deleteQuarantinedMessages(senderId);
  }
}
