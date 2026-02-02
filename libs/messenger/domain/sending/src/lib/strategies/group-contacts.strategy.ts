import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { URN } from '@nx-platform-application/platform-types';

import {
  SendStrategy,
  SendContext,
  OutboundTarget,
} from '../send-strategy.interface';

@Injectable({ providedIn: 'root' })
export class ContactGroupStrategy implements SendStrategy {
  private logger = inject(Logger);
  private identityResolver = inject(IdentityResolver);
  private contactsApi = inject(ContactsQueryApi);

  async getTargets(ctx: SendContext): Promise<OutboundTarget[]> {
    const { recipientUrn } = ctx;

    // 1. Fetch Members from Contacts API (The "Lookup")
    const group = await this.contactsApi.getGroupParticipants(recipientUrn);
    if (!group || group.length === 0) {
      this.logger.warn('[ContactGroup] No members found', {
        group: recipientUrn,
      });
      return [];
    }

    // 2. Map to Network Handles (The "Mapping")
    // We must send to the Network URN (e.g., urn:messenger:user:123), not the Contact URN.
    const resolutionPromises = group.map((m) =>
      this.identityResolver.resolveToHandle(m.id),
    );
    const resolvedHandles = await Promise.all(resolutionPromises);

    // Filter out unresolved users
    const validRecipients = resolvedHandles.filter((h): h is URN => !!h);

    if (validRecipients.length === 0) {
      return [];
    }

    // 3. Return Targets (Client-Side Fan-Out)
    // Like Broadcast, we explode this into N separate 1:1 messages
    return validRecipients.map((handle) => ({
      conversationUrn: handle,
      recipients: [handle],
    }));
  }
}
