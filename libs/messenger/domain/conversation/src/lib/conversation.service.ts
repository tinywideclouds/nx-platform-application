import {
  Injectable,
  inject,
  signal,
  WritableSignal,
  computed,
} from '@angular/core';
import { Subject } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageDeliveryStatus,
  ConversationSummary,
} from '@nx-platform-application/messenger-types';

import {
  HistoryReader,
  HistoryQuery,
  ConversationStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';

import { AddressBookApi } from '@nx-platform-application/contacts-api';
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';

import { MessageViewMapper } from './message-view.mapper';
import {
  MessageContentParser,
  MessageGroupInvite,
  MessageGroupInviteResponse,
} from '@nx-platform-application/messenger-domain-message-content';

const DEFAULT_PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private logger = inject(Logger);

  private historyReader = inject(HistoryReader);
  private storage = inject(ConversationStorage);
  private chatSync = inject(ChatSyncService);
  private addressBook = inject(AddressBookApi);

  private keyService = inject(ChatKeyService);
  private mapper = inject(MessageViewMapper);
  private contentParser = inject(MessageContentParser);

  public readonly myUrn = signal<URN | null>(null);
  public readonly selectedConversation = signal<URN | null>(null);

  // STATE: Tracks Lurker vs Member status
  public readonly membershipStatus = signal<'invited' | 'joined' | 'unknown'>(
    'unknown',
  );

  // Internal: The unfiltered stream from DB/Network
  private readonly _rawMessages: WritableSignal<ChatMessage[]> = signal([]);

  // PUBLIC COMPUTED: Applies the "Lurker Filter"
  public readonly messages = computed(() => {
    const raw = this._rawMessages();
    const status = this.membershipStatus();
    const currentUrn = this.selectedConversation();
    const me = this.myUrn();

    // 1. Direct Chats (Non-Group): Show Everything
    if (currentUrn && currentUrn.entityType !== 'group') return raw;

    // 2. Member/Joined: Show Everything
    if (status === 'joined') return raw;

    // 3. Lurker (Invited/Unknown): Shield Content
    return raw.filter(
      (m) =>
        m.typeId.equals(MessageGroupInviteResponse) ||
        m.typeId.equals(MessageGroupInvite) ||
        (me && m.senderId.equals(me)),
    );
  });

  public readonly genesisReached = signal<boolean>(false);
  public readonly isLoadingHistory = signal<boolean>(false);
  public readonly isRecipientKeyMissing = signal<boolean>(false);
  public readonly firstUnreadId = signal<string | null>(null);
  public readonly typingActivity = signal<Map<string, Temporal.Instant>>(
    new Map(),
  );

  public readonly readReceiptTrigger$ = new Subject<string[]>();

  public readonly readCursors = computed(() => {
    const msgs = this.messages();
    const me = this.myUrn();
    const partner = this.selectedConversation();

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

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    return this.historyReader.getConversationSummaries();
  }

  async loadConversation(urn: URN | null, myUrn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      this.myUrn.set(myUrn);

      const current = this.selectedConversation();
      if (current?.equals(urn) && urn !== null) {
        await this.storage.markConversationAsRead(urn);
        return;
      }

      this.selectedConversation.set(urn);
      this.genesisReached.set(false);
      this.firstUnreadId.set(null);
      this._rawMessages.set([]);
      this.membershipStatus.set('unknown');

      if (!urn) {
        this.isRecipientKeyMissing.set(false);
        return;
      }

      // LOGIC: Determine Group Status
      if (urn.entityType === 'group') {
        const group = await this.addressBook.getGroup(urn);
        if (group && myUrn) {
          const me = group.members.find((m) => m.contactId.equals(myUrn));
          if (me) {
            const s = me.status;
            if (s === 'joined' || s === 'added') {
              this.membershipStatus.set('joined');
            } else if (s === 'invited') {
              this.membershipStatus.set('invited');
            } else {
              this.membershipStatus.set('unknown');
            }
          } else {
            this.membershipStatus.set('unknown');
          }
        } else {
          this.membershipStatus.set('invited');
        }
      } else {
        this.membershipStatus.set('joined');
      }

      const index = await this.storage.getConversationIndex(urn);
      const unreadCount = index?.unreadCount || 0;

      await this.storage.markConversationAsRead(urn);

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
          .map((m) => this.mapper.toView(m));

        if (unreadCount > 0 && viewMessages.length > 0) {
          const boundaryIndex = Math.max(0, viewMessages.length - unreadCount);
          const boundaryMsg = viewMessages[boundaryIndex];
          if (boundaryMsg) {
            this.firstUnreadId.set(boundaryMsg.id);
          }
        }

        if (myUrn) {
          await this.processReadReceipts(viewMessages, myUrn);
        }

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
      const urn = this.selectedConversation();
      if (!urn || currentMsgs.length === 0) return;

      this.isLoadingHistory.set(true);
      try {
        const oldestMsg = currentMsgs[0];

        const result = await this.loadSmartHistory({
          conversationUrn: urn,
          limit: DEFAULT_PAGE_SIZE,
          beforeTimestamp: oldestMsg.sentTimestamp,
        });

        if (result.messages.length > 0) {
          const newHistory = result.messages.map((m) => this.mapper.toView(m));
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
      const index = await this.storage.getConversationIndex(conversationUrn);
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
        this.mapper.toView({ ...m, textContent: undefined }),
      );
      this.upsertMessages(viewed, null);
    }
  }

  upsertMessages(messages: ChatMessage[], myUrn: URN | null): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;

    const relevant = messages.filter((msg) =>
      msg.conversationUrn.equals(activeConvo),
    );

    if (relevant.length > 0) {
      const viewed = relevant.map((m) => this.mapper.toView(m));

      if (myUrn) {
        this.processReadReceipts(viewed, myUrn).catch((err) =>
          this.logger.warn('Failed to process live receipts', err),
        );
      }

      this._rawMessages.update((current) => {
        const lookup = new Map(current.map((m) => [m.id, m]));

        viewed.forEach((m) => {
          lookup.set(m.id, m);
        });

        return Array.from(lookup.values()).sort((a, b) =>
          a.sentTimestamp.localeCompare(b.sentTimestamp),
        );
      });

      this.storage.markConversationAsRead(activeConvo);
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

  private async processReadReceipts(
    messages: ChatMessage[],
    myUrn: URN,
  ): Promise<void> {
    const unreadMessages = messages.filter(
      (m) => !m.senderId.equals(myUrn) && m.status !== 'read',
    );

    if (unreadMessages.length === 0) return;

    const ids = unreadMessages.map((m) => m.id);
    unreadMessages.forEach((m) => (m.status = 'read'));

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
}
