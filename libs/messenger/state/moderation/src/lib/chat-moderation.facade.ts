import { Injectable, inject, computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { GatekeeperApi } from '@nx-platform-application/contacts-api';
import { BlockedIdentity } from '@nx-platform-application/contacts-types';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';

@Injectable({ providedIn: 'root' })
export class ChatModerationFacade {
  private readonly logger = inject(Logger);
  private readonly gatekeeper = inject(GatekeeperApi);
  private readonly quarantineService = inject(QuarantineService);
  private readonly storageService = inject(ChatStorageService);
  private readonly parser = inject(MessageContentParser);

  // --- STATE ---

  // Reactively track the blocked list from the API
  private readonly blockedIdentities = toSignal(this.gatekeeper.blocked$, {
    initialValue: [] as BlockedIdentity[],
  });

  // Compute a fast lookup set for the UI and other services
  public readonly blockedSet: Signal<Set<string>> = computed(() => {
    const all = this.blockedIdentities();
    const set = new Set<string>();
    for (const b of all) {
      if (b.scopes.includes('messenger') || b.scopes.includes('all')) {
        set.add(b.urn.toString());
      }
    }
    return set;
  });

  // --- ACTIONS ---

  public async block(
    urns: URN[],
    scope: 'messenger' | 'all' = 'messenger',
  ): Promise<void> {
    // 1. Block in the Contacts API
    await Promise.all(
      urns.map((urn) => this.gatekeeper.blockIdentity(urn, [scope])),
    );

    // 2. Reject any pending messages in Quarantine
    await Promise.all(urns.map((urn) => this.quarantineService.reject(urn)));
  }

  public async dismissPending(urns: URN[]): Promise<void> {
    await Promise.all(urns.map((urn) => this.quarantineService.reject(urn)));
  }

  public async getQuarantinedMessages(urn: URN): Promise<ChatMessage[]> {
    return this.quarantineService.retrieveForInspection(urn);
  }

  /**
   * Moves messages from the Quarantine hold into the main database.
   * This parses the raw bytes (which were skipped during ingestion) and saves them as real messages.
   */
  public async promoteQuarantinedMessages(
    senderUrn: URN,
    targetConversationUrn?: URN,
  ): Promise<void> {
    const messages =
      await this.quarantineService.retrieveForInspection(senderUrn);

    if (messages.length === 0) return;

    const promotedMessages: ChatMessage[] = [];

    for (const tm of messages) {
      if (!tm.payloadBytes) continue;

      try {
        // Parse the raw payload now that we trust the sender
        const parsed = this.parser.parse(tm.typeId, tm.payloadBytes);

        if (parsed.kind === 'content') {
          promotedMessages.push({
            id: tm.id,
            senderId: tm.senderId,
            sentTimestamp: tm.sentTimestamp as ISODateTimeString,
            typeId: tm.typeId,
            status: 'received',
            conversationUrn: targetConversationUrn || parsed.conversationId,
            tags: parsed.tags,
            payloadBytes: this.parser.serialize(parsed.payload), // Reserialize to ensure consistency
            textContent:
              parsed.payload.kind === 'text' ? parsed.payload.text : undefined,
          });
        }
      } catch (e) {
        this.logger.error(
          `[Moderation] Failed to parse quarantined message from ${senderUrn}`,
          e,
        );
      }
    }

    if (promotedMessages.length > 0) {
      await Promise.all(
        promotedMessages.map((msg) => this.storageService.saveMessage(msg)),
      );
    }

    // Clean up the quarantine now that they are safe
    await this.quarantineService.reject(senderUrn);
  }
}
