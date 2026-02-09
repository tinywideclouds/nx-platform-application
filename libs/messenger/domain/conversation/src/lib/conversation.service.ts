// libs/messenger/domain/conversation/src/lib/conversation.service.ts

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
import {
  MessageContentParser,
  MessageGroupInvite,
  MessageGroupInviteResponse,
  MessageTypeSystem,
} from '@nx-platform-application/messenger-domain-message-content';
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { GroupMemberStatus } from '@nx-platform-application/directory-types';

// --- NEW TYPES ---

export type ConversationKind =
  | { type: 'direct'; partnerId: URN }
  | { type: 'broadcast'; recipients: URN[] }
  | {
      type: 'consensus';
      myStatus: GroupMemberStatus | 'unknown';
      memberCount?: number;
    };

export interface ConversationResolution {
  conversation: Conversation;
  kind: ConversationKind;
  isRecipientKeyMissing: boolean;
}

export interface InitialMessageLoad {
  messages: ChatMessage[];
  genesisReached: boolean;
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
   * PHASE 1: RESOLUTION
   * Identifies the nature of the conversation and the user's status within it.
   * Does NOT load heavy message history.
   */
  async resolveConversation(urn: URN): Promise<ConversationResolution> {
    // 1. Fetch Metadata (Local Storage & Directory)
    let conversation = await this.storage.getConversation(urn);
    const kind = await this.determineKind(urn);

    // 2. Fallback: Create ephemeral conversation object if not in DB
    if (!conversation) {
      conversation = await this.createEphemeralConversation(urn);
    }

    // 3. Check Keys (Security)
    const hasKeys = await this.keyService.checkRecipientKeys(urn);

    return {
      conversation,
      kind,
      isRecipientKeyMissing: !hasKeys,
    };
  }

  /**
   * PHASE 2: LOADING
   * Fetches messages, applying filters based on the resolution kind.
   */
  async loadInitialMessages(
    urn: URN,
    kind: ConversationKind,
  ): Promise<InitialMessageLoad> {
    const conversation = await this.storage.getConversation(urn);
    const limit = Math.max(
      DEFAULT_PAGE_SIZE,
      (conversation?.unreadCount || 0) + 5,
    );

    // 2. Load History
    const history = await this.historyReader.getMessages({
      conversationUrn: urn,
      limit,
    });

    let messages = history.messages.reverse(); // Oldest -> Newest

    // 3. Apply "Restricted View" Filter for Consensus Groups
    // Only show Signals if invited; hide content until joined.
    if (kind.type === 'consensus' && kind.myStatus === 'invited') {
      messages = messages.filter((m) => this.isSignalMessage(m));
    }

    // 4. Calculate Unread Marker
    let firstUnreadId: string | null = null;
    const unreadCount = conversation?.unreadCount || 0;
    if (unreadCount > 0 && messages.length > 0) {
      const boundary = Math.max(0, messages.length - unreadCount);
      if (messages[boundary]) firstUnreadId = messages[boundary].id;
    }

    return {
      messages,
      genesisReached: history.genesisReached,
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

  private async determineKind(urn: URN): Promise<ConversationKind> {
    // 1. Consensus Group (Directory)
    if (urn.entityType === 'group') {
      try {
        const group = await this.directory.getGroup(urn);
        if (group) {
          const myUrn = this.sessionService.snapshot.networkUrn?.toString();
          const status = myUrn
            ? (group.memberState[myUrn] ?? 'unknown')
            : 'unknown';
          return {
            type: 'consensus',
            myStatus: status,
            memberCount: Object.keys(group.memberState).length,
          };
        }
      } catch (e) {
        this.logger.warn('[ConversationService] Directory lookup failed', e);
      }
    }

    // 2. Default Direct (1:1)
    return { type: 'direct', partnerId: urn };
  }

  private async createEphemeralConversation(urn: URN): Promise<Conversation> {
    const contact = await this.contactsQuery.resolveIdentity(urn);
    return {
      id: urn,
      name: contact?.alias || 'New Chat',
      lastActivityTimestamp: Temporal.Now.instant().toString() as any,
      snippet: '',
      unreadCount: 0,
      genesisTimestamp: null,
      lastModified: Temporal.Now.instant().toString() as any,
    };
  }

  private isSignalMessage(msg: ChatMessage): boolean {
    return (
      msg.typeId.equals(MessageTypeSystem) ||
      msg.typeId.equals(MessageGroupInvite) ||
      msg.typeId.equals(MessageGroupInviteResponse)
    );
  }
}
