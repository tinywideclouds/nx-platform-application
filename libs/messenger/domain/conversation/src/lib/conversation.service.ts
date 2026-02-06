import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  Conversation,
} from '@nx-platform-application/messenger-types';

import {
  HistoryReader,
  ConversationStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';

import { DirectoryQueryApi } from '@nx-platform-application/directory-api';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';

export interface ConversationContext {
  conversation: Conversation;
  messages: ChatMessage[];
  membershipStatus: 'joined' | 'invited' | 'unknown';
  genesisReached: boolean;
  isRecipientKeyMissing: boolean;
  firstUnreadId: string | null;
}

const DEFAULT_PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private logger = inject(Logger);
  private historyReader = inject(HistoryReader);
  private storage = inject(ConversationStorage);
  private directory = inject(DirectoryQueryApi);
  private keyService = inject(ChatKeyService);
  private contentParser = inject(MessageContentParser);
  private sessionService = inject(SessionService);
  private contactsQuery = inject(ContactsQueryApi);

  /**
   * PURE IO: Fetches all data required to render a conversation.
   * Does not hold state.
   */
  async loadContext(urn: URN): Promise<ConversationContext> {
    // 1. Resolve Membership (Parallelizable)
    const membershipPromise = this.resolveMembership(urn);

    // 2. Resolve Metadata / Create Shell
    let conversation = await this.storage.getConversation(urn);
    if (!conversation) {
      const contact = await this.contactsQuery.resolveIdentity(urn);
      conversation = {
        id: urn,
        name: contact?.alias || 'New Chat',
        lastActivityTimestamp: Temporal.Now.instant().toString() as any,
        snippet: '',
        unreadCount: 0,
        genesisTimestamp: null,
        lastModified: Temporal.Now.instant().toString() as any,
      };
    }

    // 3. Mark Read
    const unreadCount = conversation.unreadCount || 0;
    await this.storage.markConversationAsRead(urn);

    // 4. Check Keys
    const hasKeys = await this.keyService.checkRecipientKeys(urn);

    // 5. Load History
    const limit = Math.max(DEFAULT_PAGE_SIZE, unreadCount + 5);
    const history = await this.historyReader.getMessages({
      conversationUrn: urn,
      limit,
    });

    // 6. Calculate Unread Marker
    const messages = history.messages.reverse(); // Oldest -> Newest
    let firstUnreadId: string | null = null;
    if (unreadCount > 0 && messages.length > 0) {
      const boundary = Math.max(0, messages.length - unreadCount);
      if (messages[boundary]) firstUnreadId = messages[boundary].id;
    }

    return {
      conversation,
      messages,
      membershipStatus: await membershipPromise,
      genesisReached: history.genesisReached,
      isRecipientKeyMissing: !hasKeys,
      firstUnreadId,
    };
  }

  async conversationExists(urn: URN): Promise<boolean> {
    return this.storage.conversationExists(urn);
  }

  async loadMoreMessages(
    urn: URN,
    beforeTimestamp: string,
  ): Promise<ChatMessage[]> {
    const result = await this.historyReader.getMessages({
      conversationUrn: urn,
      limit: DEFAULT_PAGE_SIZE,
      beforeTimestamp,
    });
    // HistoryReader returns Newest -> Oldest.
    // UI usually prepends these.
    return result.messages;
  }

  /**
   * Recovers a failed message text for retry.
   * Pure logic: Parses bytes, Deletes from DB, Returns text.
   */
  async recoverFailedMessage(
    messageId: string,
    knownPayloadBytes?: Uint8Array,
    knownTypeId?: URN,
  ): Promise<string | undefined> {
    let payload = knownPayloadBytes;
    let typeId = knownTypeId;

    // If not provided, fetch from DB
    if (!payload || !typeId) {
      const msg = await this.storage.getMessage(messageId);
      if (!msg) return undefined;
      payload = msg.payloadBytes;
      typeId = msg.typeId;
    }

    if (!payload) return undefined;

    let textToRestore: string | undefined;
    try {
      const parsed = this.contentParser.parse(typeId, payload);
      if (parsed.kind === 'content' && parsed.payload.kind === 'text') {
        textToRestore = parsed.payload.text;
      }
    } catch (e) {
      this.logger.warn('Failed to parse message for recovery', e);
    }

    await this.storage.deleteMessage(messageId);
    return textToRestore;
  }

  // --- ACTIONS ---

  async startNewConversation(urn: URN, name: string): Promise<void> {
    await this.storage.startConversation(urn, name);
  }

  async performHistoryWipe(): Promise<void> {
    await this.storage.clearMessageHistory();
  }

  async getAllConversations(): Promise<Conversation[]> {
    return this.historyReader.getAllConversations();
  }

  async fetchMessages(ids: string[]): Promise<ChatMessage[]> {
    if (ids.length === 0) return [];
    const msgs = await Promise.all(
      ids.map((id) => this.storage.getMessage(id)),
    );
    return msgs.filter((m): m is ChatMessage => !!m);
  }

  // --- HELPERS ---

  private async resolveMembership(
    urn: URN,
  ): Promise<'joined' | 'invited' | 'unknown'> {
    if (urn.entityType !== 'group') return 'joined';
    try {
      const group = await this.directory.getGroup(urn);
      const myUrn = this.sessionService.snapshot.networkUrn?.toString();
      if (group && myUrn && group.memberState[myUrn]) {
        return group.memberState[myUrn] as any;
      }
    } catch (e) {
      /* ignore */
    }
    return 'unknown';
  }
}
