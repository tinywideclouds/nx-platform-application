import { Injectable, inject, computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';

// ✅ NEW: Use Directory for Blocking Logic
import {
  DirectoryQueryApi,
  DirectoryMutationApi,
} from '@nx-platform-application/directory-api';

const BLOCK_LIST_URN = URN.parse('urn:directory:group:block-list');

@Injectable({ providedIn: 'root' })
export class ChatModerationFacade {
  private readonly logger = inject(Logger);
  private readonly quarantineService = inject(QuarantineService);
  private readonly storageService = inject(ChatStorageService);
  private readonly parser = inject(MessageContentParser);

  // ✅ Architecture Swap
  private readonly directoryQuery = inject(DirectoryQueryApi);
  private readonly directoryMutation = inject(DirectoryMutationApi);

  // --- STATE ---

  // Reactively track the Block List Group from Directory
  // Note: For now we fetch once. In a real app, DirectoryQueryApi should expose a stream.
  private readonly blockListGroup = toSignal(
    from(this.directoryQuery.getGroup(BLOCK_LIST_URN)),
    { initialValue: null },
  );

  // Compute a fast lookup set for the UI
  public readonly blockedSet: Signal<Set<string>> = computed(() => {
    const group = this.blockListGroup();
    const set = new Set<string>();
    if (group?.memberState) {
      // Any member in the block-list group is considered blocked
      Object.keys(group.memberState).forEach((key) => {
        if (group.memberState[key] === 'joined') {
          set.add(key);
        }
      });
    }
    return set;
  });

  // --- ACTIONS ---

  public async block(
    urns: URN[],
    scope: 'messenger' | 'all' = 'messenger',
  ): Promise<void> {
    // 1. Block = Add to Block List Group
    // We treat "Blocking" as "Joining" the Block List.
    await Promise.all(
      urns.map((urn) =>
        this.directoryMutation.updateMemberStatus(
          BLOCK_LIST_URN,
          urn,
          'joined',
        ),
      ),
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
            payloadBytes: this.parser.serialize(parsed.payload),
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

    await this.quarantineService.reject(senderUrn);
  }
}
