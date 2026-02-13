import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
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
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import {
  MessageContentParser,
  MessageGroupInvite,
  MessageGroupInviteResponse,
  MessageTypeSystem,
} from '@nx-platform-application/messenger-domain-message-content';

import { GroupMemberStatus } from '@nx-platform-application/directory-types';

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
}

export interface InitialMessageLoad {
  messages: ChatMessage[];
  genesisReached: boolean;
  firstUnreadId: string | null;
}

const DEFAULT_PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class ConversationQueryService {
  private readonly logger = inject(Logger);
  private readonly historyReader = inject(HistoryReader);
  private readonly storage = inject(ConversationStorage);
  private readonly directory = inject(DirectoryQueryApi);
  private readonly sessionService = inject(SessionService);
  private readonly contentParser = inject(MessageContentParser);

  // --- STATE CONTAINER (Hot Cache) ---
  // Internal Map for O(1) lookups and managing insertion order.
  private readonly _cache = new Map<string, Conversation>();

  // External Stream for the UI (Derived from Map).
  private readonly _conversations = new BehaviorSubject<Conversation[]>([]);
  public readonly conversations$ = this._conversations.asObservable();

  /**
   * INJECTION POINT:
   * Efficiently updates or adds a conversation.
   * Handles "Bump to Top" automatically via Map insertion order.
   */
  public upsertToCache(conversation: Conversation): void {
    const key = conversation.id.toString();

    // 1. Delete first to reset insertion order (moves it to the "end" when set)
    if (this._cache.has(key)) {
      this._cache.delete(key);
    }

    // 2. Set the new value (Appends to the Map)
    this._cache.set(key, conversation);

    // 3. Refresh the View
    this.refreshStream();
  }

  /**
   * REMOVAL POINT:
   * Efficient O(1) removal.
   */
  public removeFromCache(urn: URN): void {
    const key = urn.toString();
    if (this._cache.delete(key)) {
      this.refreshStream();
    }
  }

  public getConversation(urn: URN): Conversation | undefined {
    return this._cache.get(urn.toString());
  }

  private refreshStream() {
    // Map.values() iterates in insertion order (Oldest -> Newest).
    // We reverse it so the UI sees [Newest, ..., Oldest].
    const list = Array.from(this._cache.values()).reverse();
    this._conversations.next(list);
  }

  // --- READ FACADE ---

  async resolveConversation(urn: URN): Promise<ConversationResolution> {
    // 1. Fetch Metadata (Local Storage & Directory)
    let conversation = await this.storage.getConversation(urn);

    if (!conversation) {
      conversation = this._cache.get(urn.toString());
    }

    // At this stage we should have a conversation so throw if none
    if (!conversation) {
      throw Error('no convervation to resolve');
    }

    const kind = await this.determineKind(urn);

    return {
      conversation,
      kind,
    };
  }

  // --- INTERNAL READ LOGIC ---

  public async determineKind(urn: URN): Promise<ConversationKind> {
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
        this.logger.warn(
          '[ConversationQueryService] Directory lookup failed',
          e,
        );
      }
    }
    return { type: 'direct', partnerId: urn };
  }

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

  // --- ADDITIONAL READS ---

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

  async recoverFailedMessage(
    messageId: string,
    knownPayloadBytes?: Uint8Array,
    knownTypeId?: URN,
  ): Promise<string | undefined> {
    let payload = knownPayloadBytes;
    let typeId = knownTypeId;

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

  async conversationExists(urn: URN): Promise<boolean> {
    return this.storage.conversationExists(urn);
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

  private isSignalMessage(msg: ChatMessage): boolean {
    return (
      msg.typeId.equals(MessageTypeSystem) ||
      msg.typeId.equals(MessageGroupInvite) ||
      msg.typeId.equals(MessageGroupInviteResponse)
    );
  }
}
