import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  ChatMessage,
} from '@nx-platform-application/messenger-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';

import { QuarantineStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';

@Injectable({ providedIn: 'root' })
export class QuarantineService {
  // ✅ Inject the Abstract Token
  // Important: The application root config must provide:
  // { provide: QuarantineStorage, useClass: DexieQuarantineStorage }
  private readonly storage = inject(QuarantineStorage);
  private readonly contacts = inject(ContactsStateService);
  private readonly logger = inject(Logger);
  private readonly identityResolver = inject(IdentityResolver);

  async process(
    message: TransportMessage,
    blockedSet: Set<string>,
  ): Promise<URN | null> {
    const senderStr = message.senderId.toString();

    if (blockedSet.has(senderStr)) {
      this.logger.info(`[Gatekeeper] REJECTED: Blocked sender ${senderStr}`);
      return null;
    }

    const canonicalUrn = await this.identityResolver.resolveToContact(
      message.senderId,
    );

    const isTrusted = await this.contacts.isTrusted(canonicalUrn);

    if (!isTrusted) {
      this.logger.info(`[Gatekeeper] DETAINED: Unknown sender ${senderStr}`);
      await this.storage.saveQuarantinedMessage(message);
      return null;
    }

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
