import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  ChatMessage,
} from '@nx-platform-application/messenger-types';
// ✅ 1. Remove incorrect import
// import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { Logger } from '@nx-platform-application/console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
// ✅ 2. Import the Abstract Port
import { QuarantineStorage } from './quarantine.storage';

@Injectable({ providedIn: 'root' })
export class QuarantineService {
  // ✅ 3. Inject the Port (Abstract)
  // Angular will provide DexieQuarantineStorage at runtime via CHAT_STORAGE_PROVIDERS
  private storage = inject(QuarantineStorage);

  private contacts = inject(ContactsStateService);
  private logger = inject(Logger);
  private identityResolver = inject(IdentityResolver);

  /**
   * Pipeline Step 1: Gatekeeper & Resolver.
   * Checks if the message is allowed and resolves its canonical identity.
   *
   * @returns The Canonical URN (Contact UUID) if allowed, or NULL if blocked/detained.
   */
  async process(
    message: TransportMessage,
    blockedSet: Set<string>,
  ): Promise<URN | null> {
    const senderStr = message.senderId.toString();

    // 1. Block Check (Fast Fail on Wire Handle)
    if (blockedSet.has(senderStr)) {
      this.logger.info(`[Gatekeeper] REJECTED: Blocked sender ${senderStr}`);
      return null;
    }

    // 2. Resolve Identity ONCE
    // "Who is this handle in my local contacts?"
    const canonicalUrn = await this.identityResolver.resolveToContact(
      message.senderId,
    );

    // 3. Trust Check
    // We check the RESOLVED identity.
    const isTrusted = await this.contacts.isTrusted(canonicalUrn);

    if (!isTrusted) {
      this.logger.info(`[Gatekeeper] DETAINED: Unknown sender ${senderStr}`);
      // ✅ Now valid: QuarantineStorage defines this method
      await this.storage.saveQuarantinedMessage(message);
      return null;
    }

    // 4. Return the Canonical Identity for the next step
    return canonicalUrn;
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
