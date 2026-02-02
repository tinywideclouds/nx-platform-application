import {
  Injectable,
  inject,
  signal,
  WritableSignal,
  computed,
} from '@angular/core';
import { Subject } from 'rxjs';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageDeliveryStatus,
  Conversation,
} from '@nx-platform-application/messenger-types';

import {
  HistoryReader,
  HistoryQuery,
  ConversationStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';

import { DirectoryQueryApi } from '@nx-platform-application/directory-api';
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';

import {
  MessageContentParser,
  MessageGroupInvite,
  MessageGroupInviteResponse,
  MessageTypeSystem,
} from '@nx-platform-application/messenger-domain-message-content';

import { SessionService } from '@nx-platform-application/messenger-domain-session';

import { ContactsQueryApi } from '@nx-platform-application/contacts-api';

const DEFAULT_PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private logger = inject(Logger);
  private historyReader = inject(HistoryReader);
  private storage = inject(ConversationStorage);
  private chatSync = inject(ChatSyncService);
  private directory = inject(DirectoryQueryApi);
  private keyService = inject(ChatKeyService);

  // ✅ Single Source of Truth for Parsing
  private contentParser = inject(MessageContentParser);

  private readonly sessionService = inject(SessionService);

  // Contacts services for temp conversation shells
  private contactsQuery = inject(ContactsQueryApi);

  public readonly myUrn = signal<URN | null>(null);
  public readonly selectedConversation = signal<Conversation | null>(null);
  public readonly membershipStatus = signal<'invited' | 'joined' | 'unknown'>(
    'unknown',
  );

  private readonly _rawMessages: WritableSignal<ChatMessage[]> = signal([]);

  public readonly messages = computed(() => {
    const raw = this._rawMessages();
    const status = this.membershipStatus();
    const currentUrn = this.selectedConversation()?.id;
    const me = this.myUrn();

    if (currentUrn && currentUrn.entityType !== 'group') return raw;
    if (status === 'joined') return raw;

    const filtered = raw.filter(
      (m) =>
        m.typeId.equals(MessageGroupInviteResponse) ||
        m.typeId.equals(MessageGroupInvite) ||
        m.typeId.equals(MessageTypeSystem) ||
        (me && m.senderId.equals(me)),
    );

    return filtered;
  });

  public readonly genesisReached = signal<boolean>(false);
  public readonly isLoadingHistory = signal<boolean>(false);
  public readonly isRecipientKeyMissing = signal<boolean>(false);
  public readonly firstUnreadId = signal<string | null>(null);
  public readonly typingActivity = signal<Map<string, Temporal.Instant>>(
    new Map(),
  );

  private readonly _persistedConversations = signal<Conversation[]>([]);

  // 2. Keep your existing computed logic (It handles the shell merge perfectly)
  public readonly allConversations = computed(() => {
    const persisted = this._persistedConversations();
    const active = this.selectedConversation();

    // If we have an active shell that isn't in the DB yet, prepend it
    if (active && !persisted.some((c) => c.id.equals(active.id))) {
      return [active, ...persisted];
    }
    return persisted;
  });

  // 3. Update loadConversations to SET the signal
  async refreshConversationList(): Promise<void> {
    const list = await this.historyReader.getAllConversations();
    this._persistedConversations.set(list);
  }

  public readonly readReceiptTrigger$ = new Subject<string[]>();

  public readonly readCursors = computed(() => {
    const msgs = this.messages();
    const me = this.myUrn();
    const partner = this.selectedConversation()?.id;

    if (!me || !partner || msgs.length === 0) return new Map<string, URN[]>();

    let cursorMessageId: string | null = null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];
      const isFromMe = msg.senderId.equals(me);
      if (isFromMe && msg.status === 'read') {
        cursorMessageId = msg.id;
        break;
      }
    }

    const map = new Map<string, URN[]>();
    if (cursorMessageId) {
      map.set(cursorMessageId, [partner]);
    }
    return map;
  });

  private operationLock = Promise.resolve();

  async conversationExists(urn: URN): Promise<boolean> {
    return this.storage.conversationExists(urn);
  }

  async startNewConversation(urn: URN, name: string): Promise<void> {
    this.logger.info(
      `[ConversationService] Starting new Conversation: ${name} (${urn})`,
    );
    await this.storage.startConversation(urn, name);
  }

  async loadConversations(): Promise<Conversation[]> {
    return this.historyReader.getAllConversations();
  }

  private setLocalUnreadCount(urn: URN, count: number): void {
    this._persistedConversations.update((list) =>
      list.map((c) => (c.id.equals(urn) ? { ...c, unreadCount: count } : c)),
    );
  }

  async loadConversation(urn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      const current = this.selectedConversation();
      if (current?.id?.equals(urn) && urn !== null) {
        await this.storage.markConversationAsRead(urn);

        this.setLocalUnreadCount(urn, 0);
        return;
      }

      if (!urn) {
        this.selectedConversation.set(null);
        this.isRecipientKeyMissing.set(false);
        this._rawMessages.set([]);
        return;
      }

      this.genesisReached.set(false);
      this.firstUnreadId.set(null);
      this._rawMessages.set([]);
      this.membershipStatus.set('unknown');

      if (urn.entityType === 'group') {
        const group = await this.directory.getGroup(urn);

        const myUrn = this.sessionService.snapshot.networkUrn;
        console.log(
          'checking my membership status from group',
          myUrn,
          group?.id,
        );

        if (group && myUrn) {
          const status = group.memberState[myUrn.toString()];
          if (status === 'joined') {
            this.membershipStatus.set('joined');
          } else if (status === 'invited') {
            this.membershipStatus.set('invited');
          } else {
            this.membershipStatus.set('unknown');
          }
        } else {
          this.membershipStatus.set('unknown');
        }
      } else {
        this.membershipStatus.set('joined');
      }

      const persisted = await this.storage.getConversation(urn);

      if (persisted) {
        this.selectedConversation.set(persisted);
      } else {
        // 3. Shell Creation (Draft Mode)
        // We only attempt to resolve names for CONTACTS.
        // Network groups should be persisted by GroupProtocol or Sync before we get here.
        const contactsIdentity = await this.contactsQuery.resolveIdentity(urn);

        if (!contactsIdentity) {
          this.logger.error('no identity');
          return;
        }

        this.selectedConversation.set({
          id: urn,
          name: contactsIdentity.alias,
          lastActivityTimestamp: Temporal.Now.instant().toString() as any,
          snippet: '',
          unreadCount: 0,
          genesisTimestamp: null,
          lastModified: Temporal.Now.instant().toString() as any,
        });
      }

      const unreadCount = persisted?.unreadCount || 0;
      await this.storage.markConversationAsRead(urn);

      this.setLocalUnreadCount(urn, 0);

      const hasKeys = await this.keyService.checkRecipientKeys(urn);
      this.isRecipientKeyMissing.set(!hasKeys);

      this.isLoadingHistory.set(true);
      try {
        const limit = Math.max(DEFAULT_PAGE_SIZE, unreadCount + 5);

        const result = await this.loadSmartHistory({
          conversationUrn: urn,
          limit: limit,
        });

        const viewMessages = result.messages
          .reverse()
          .map((m) => this.hydrateMessage(m));

        if (unreadCount > 0 && viewMessages.length > 0) {
          const boundaryIndex = Math.max(0, viewMessages.length - unreadCount);
          const boundaryMsg = viewMessages[boundaryIndex];
          if (boundaryMsg) {
            this.firstUnreadId.set(boundaryMsg.id);
          }
        }

        await this.processReadReceipts(viewMessages);

        this._rawMessages.set(viewMessages);
        this.genesisReached.set(result.genesisReached);
      } finally {
        this.isLoadingHistory.set(false);
      }
    });
  }

  async loadMoreMessages(): Promise<void> {
    if (this.isLoadingHistory() || this.genesisReached()) return;

    return this.runExclusive(async () => {
      const currentMsgs = this._rawMessages();
      const conversationUrn = this.selectedConversation()?.id;

      if (!conversationUrn || currentMsgs.length === 0) return;

      this.isLoadingHistory.set(true);
      try {
        const oldestMsg = currentMsgs[0];

        const result = await this.loadSmartHistory({
          conversationUrn,
          limit: DEFAULT_PAGE_SIZE,
          beforeTimestamp: oldestMsg.sentTimestamp,
        });

        if (result.messages.length > 0) {
          const newHistory = result.messages.map((m) => this.hydrateMessage(m));
          this._rawMessages.update((current) => [...newHistory, ...current]);
        }
        this.genesisReached.set(result.genesisReached);
      } catch (e) {
        this.logger.error('Failed to load more history', e);
      } finally {
        this.isLoadingHistory.set(false);
      }
    });
  }

  private async loadSmartHistory(query: HistoryQuery) {
    const { conversationUrn, limit, beforeTimestamp } = query;
    const isCloudEnabled = this.chatSync.isCloudEnabled();

    let result = await this.historyReader.getMessages(query);

    if (!isCloudEnabled || result.genesisReached) return result;

    if (!beforeTimestamp) {
      const index = await this.storage.getConversation(conversationUrn);
      const newestLocal = result.messages[0]?.sentTimestamp;
      const knownLatest = index?.lastActivityTimestamp;

      if (knownLatest && (!newestLocal || newestLocal < knownLatest)) {
        this.logger.info(
          `[Conversation] Local stale. Fetching vault for ${knownLatest}`,
        );
        await this.chatSync.restoreVaultForDate(knownLatest, conversationUrn);
        result = await this.historyReader.getMessages(query);
      }
    }

    if (result.messages.length < limit) {
      this.logger.info(
        `[Conversation] History deficit. Triggering Cloud Loop.`,
      );

      let cursor =
        beforeTimestamp ||
        (result.messages.length > 0
          ? result.messages[result.messages.length - 1].sentTimestamp
          : null) ||
        Temporal.Now.instant().toString();

      let addedData = false;
      const MAX_LOOPS = 3;

      for (let i = 0; i < MAX_LOOPS; i++) {
        const count = await this.chatSync.restoreVaultForDate(
          cursor,
          conversationUrn,
        );
        if (count > 0) addedData = true;

        try {
          const d = Temporal.PlainDate.from(cursor.substring(0, 10));
          cursor = d.subtract({ months: 1 }).toString() + 'T23:59:59Z';
        } catch (e) {
          break;
        }

        if (addedData && count > 10) break;
      }

      if (addedData) {
        result = await this.historyReader.getMessages(query);
      }
    }

    return result;
  }

  async applyIncomingReadReceipts(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.reloadMessages(ids);
  }

  async reloadMessages(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const freshMessages: ChatMessage[] = [];
    for (const id of ids) {
      const msg = await this.storage.getMessage(id);
      if (msg) freshMessages.push(msg);
    }

    if (freshMessages.length > 0) {
      const viewed = freshMessages.map((m) =>
        this.hydrateMessage({ ...m, textContent: undefined }),
      );
      this.upsertMessages(viewed);
    }
  }

  upsertMessages(messages: ChatMessage[]): void {
    const selectedConversation = this.selectedConversation();
    if (!selectedConversation) return;

    const relevant = messages.filter((msg) =>
      msg.conversationUrn.equals(selectedConversation.id),
    );

    if (relevant.length > 0) {
      const viewed = relevant.map((m) => this.hydrateMessage(m));

      this.processReadReceipts(viewed).catch((err) =>
        this.logger.warn('Failed to process live receipts', err),
      );

      this._rawMessages.update((current) => {
        const lookup = new Map(current.map((m) => [m.id, m]));

        viewed.forEach((m) => {
          lookup.set(m.id, m);
        });

        return Array.from(lookup.values()).sort((a, b) =>
          a.sentTimestamp.localeCompare(b.sentTimestamp),
        );
      });

      this.storage.markConversationAsRead(selectedConversation.id);
    }
  }

  updateMessageStatusInSignal(id: string, status: MessageDeliveryStatus): void {
    this._rawMessages.update((current) =>
      current.map((msg) => (msg.id === id ? { ...msg, status } : msg)),
    );
  }

  async recoverFailedMessage(messageId: string): Promise<string | undefined> {
    const targetMsg = this._rawMessages().find((m) => m.id === messageId);
    if (!targetMsg) return undefined;

    let textToRestore: string | undefined = targetMsg.textContent;

    if (!textToRestore && targetMsg.payloadBytes) {
      const parsed = this.contentParser.parse(
        targetMsg.typeId,
        targetMsg.payloadBytes,
      );
      if (parsed.kind === 'content' && parsed.payload.kind === 'text') {
        textToRestore = parsed.payload.text;
      }
    }

    await this.storage.deleteMessage(messageId);
    this._rawMessages.update((msgs) => msgs.filter((m) => m.id !== messageId));
    return textToRestore;
  }

  async performHistoryWipe(): Promise<void> {
    await this.storage.clearMessageHistory();
    this._rawMessages.set([]);
    this.genesisReached.set(false);
    this.firstUnreadId.set(null);
    this.selectedConversation.set(null);
    this.isRecipientKeyMissing.set(false);
    this.isLoadingHistory.set(false);
    this.membershipStatus.set('unknown');
    this.logger.info('[ConversationService] Local history wiped.');
  }

  private async processReadReceipts(messages: ChatMessage[]): Promise<void> {
    const myUrn = this.sessionService.snapshot.networkUrn;

    const unreadMessages = messages.filter(
      (m) => !m.senderId.equals(myUrn) && m.status !== 'read',
    );

    if (unreadMessages.length === 0) return;

    const ids = unreadMessages.map((m) => m.id);
    const idSet = new Set(ids); // Create Set for O(1) lookup

    this._rawMessages.update((current) =>
      current.map((msg) =>
        idSet.has(msg.id) ? { ...msg, status: 'read' } : msg,
      ),
    );

    await this.storage.updateMessageStatus(ids, 'read');
    this.readReceiptTrigger$.next(ids);
  }

  private async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previousLock = this.operationLock;
    let releaseLock: () => void;
    this.operationLock = new Promise((resolve) => {
      releaseLock = resolve;
    });
    try {
      await previousLock;
      return await task();
    } finally {
      releaseLock!();
    }
  }

  /**
   * ✅ NEW: Centralized Hydration Logic
   * Replaces MessageViewMapper. Uses MessageContentParser to interpret bytes.
   */
  private hydrateMessage(msg: ChatMessage): ChatMessage {
    // Idempotency: If already parsed, skip
    if (msg.textContent !== undefined) return msg;

    let textContent: string | undefined;

    if (msg.payloadBytes && msg.payloadBytes.length > 0) {
      const parsed = this.contentParser.parse(msg.typeId, msg.payloadBytes);
      if (parsed.kind === 'content' && parsed.payload.kind === 'text') {
        textContent = parsed.payload.text;
      } else if (parsed.kind === 'unknown') {
        // Fallback for debugging
        textContent = '[Unparseable Content]';
      }
    } else {
      // Empty body (e.g. typing indicator stored by mistake?)
      textContent = '';
    }

    return {
      ...msg,
      textContent,
    };
  }
}
