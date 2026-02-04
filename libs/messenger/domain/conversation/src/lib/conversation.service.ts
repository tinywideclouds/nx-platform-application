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
  private directory = inject(DirectoryQueryApi);
  private keyService = inject(ChatKeyService);
  private contentParser = inject(MessageContentParser);
  private sessionService = inject(SessionService);
  private contactsQuery = inject(ContactsQueryApi);

  // --- STATE SIGNALS ---

  public readonly selectedConversation = signal<Conversation | null>(null);
  public readonly membershipStatus = signal<'invited' | 'joined' | 'unknown'>(
    'unknown',
  );

  private readonly _rawMessages: WritableSignal<ChatMessage[]> = signal([]);

  // Computed View: Lurker Logic
  public readonly messages = computed(() => {
    const raw = this._rawMessages();
    const status = this.membershipStatus();
    const currentUrn = this.selectedConversation()?.id;
    const me = this.sessionService.snapshot.networkUrn;

    if (currentUrn && currentUrn.entityType !== 'group') return raw;
    if (status === 'joined') return raw;

    return raw.filter(
      (m) =>
        m.typeId.equals(MessageGroupInviteResponse) ||
        m.typeId.equals(MessageGroupInvite) ||
        m.typeId.equals(MessageTypeSystem) ||
        (me && m.senderId.equals(me)),
    );
  });

  public readonly genesisReached = signal<boolean>(false);
  public readonly isLoadingHistory = signal<boolean>(false);
  public readonly isRecipientKeyMissing = signal<boolean>(false);
  public readonly firstUnreadId = signal<string | null>(null);

  // Inbox State
  private readonly _persistedConversations = signal<Conversation[]>([]);

  public readonly allConversations = computed(() => {
    const persisted = this._persistedConversations();
    const active = this.selectedConversation();

    // Optimistic merge
    if (active && !persisted.some((c) => c.id.equals(active.id))) {
      return [active, ...persisted];
    }
    return persisted;
  });

  public readonly readReceiptTrigger$ = new Subject<string[]>();

  /**
   * ✅ RESTORED & FIXED: Read Cursors
   * Computes who has read up to which message.
   * Filters out "Me".
   */
  public readonly readCursors = computed(() => {
    const msgs = this.messages();
    const me = this.sessionService.snapshot.networkUrn;
    const active = this.selectedConversation();

    if (!me || !active || msgs.length === 0) return new Map<string, URN[]>();

    const cursors = new Map<string, URN[]>();
    const seenUsers = new Set<string>();
    const myUrnStr = me.toString();

    // Scan backwards (Newest -> Oldest)
    // We want the LATEST message a user has read.
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];

      // Strategy A: Use ReceiptMap (Groups & Rich 1:1)
      if (msg.receiptMap) {
        for (const [userId, status] of Object.entries(msg.receiptMap)) {
          // 1. Must be 'read'
          // 2. Must not be Me (I don't need to see my own face)
          // 3. Must be the first time we see this user (since we are scanning backwards)
          if (
            status === 'read' &&
            userId !== myUrnStr &&
            !seenUsers.has(userId)
          ) {
            if (!cursors.has(msg.id)) cursors.set(msg.id, []);
            cursors.get(msg.id)!.push(URN.parse(userId));
            seenUsers.add(userId);
          }
        }
      }

      // Strategy B: Fallback for 1:1 (If ReceiptMap is empty/missing but status is read)
      // If I sent it, and it's read, then the Partner read it.
      if (
        active.id.entityType === 'user' &&
        msg.senderId.equals(me) &&
        msg.status === 'read'
      ) {
        const partnerUrnStr = active.id.toString();
        if (!seenUsers.has(partnerUrnStr)) {
          if (!cursors.has(msg.id)) cursors.set(msg.id, []);
          cursors.get(msg.id)!.push(active.id);
          seenUsers.add(partnerUrnStr);
        }
      }
    }

    return cursors;
  });

  private operationLock = Promise.resolve();

  // --- PUBLIC API ---

  async conversationExists(urn: URN): Promise<boolean> {
    return this.storage.conversationExists(urn);
  }

  async startNewConversation(urn: URN, name: string): Promise<void> {
    await this.storage.startConversation(urn, name);
    await this.refreshConversationList();
  }

  async getAllConversations(): Promise<Conversation[]> {
    return this.historyReader.getAllConversations();
  }

  async refreshConversationList(): Promise<void> {
    const list = await this.historyReader.getAllConversations();
    this._persistedConversations.set(list);
  }

  async loadConversation(urn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      // 1. Handle Deselect
      if (!urn) {
        this.selectedConversation.set(null);
        this.isRecipientKeyMissing.set(false);
        this._rawMessages.set([]);
        return;
      }

      // 2. Handle Re-select (Just mark read)
      const current = this.selectedConversation();
      if (current?.id?.equals(urn)) {
        await this.storage.markConversationAsRead(urn);
        this.setLocalUnreadCount(urn, 0);
        return;
      }

      // 3. Full Load
      this.genesisReached.set(false);
      this.firstUnreadId.set(null);
      this._rawMessages.set([]);
      this.membershipStatus.set('unknown');

      // Check Group Membership
      if (urn.entityType === 'group') {
        const group = await this.directory.getGroup(urn);
        const myUrn = this.sessionService.snapshot.networkUrn;

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

      // Load Metadata
      let persisted = await this.storage.getConversation(urn);

      if (persisted) {
        this.selectedConversation.set(persisted);
      } else {
        const contactsIdentity = await this.contactsQuery.resolveIdentity(urn);
        const shell: Conversation = {
          id: urn,
          name: contactsIdentity?.alias || 'New Chat',
          lastActivityTimestamp: Temporal.Now.instant().toString() as any,
          snippet: '',
          unreadCount: 0,
          genesisTimestamp: null,
          lastModified: Temporal.Now.instant().toString() as any,
        };
        this.selectedConversation.set(shell);
      }

      // Load Messages
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

        const viewMessages = result.messages.reverse();

        if (unreadCount > 0 && viewMessages.length > 0) {
          const boundaryIndex = Math.max(0, viewMessages.length - unreadCount);
          if (viewMessages[boundaryIndex]) {
            this.firstUnreadId.set(viewMessages[boundaryIndex].id);
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
          this._rawMessages.update((current) => [
            ...result.messages,
            ...current,
          ]);
        }
        this.genesisReached.set(result.genesisReached);
      } catch (e) {
        this.logger.error('Failed to load more history', e);
      } finally {
        this.isLoadingHistory.set(false);
      }
    });
  }

  /**
   * Recovers a failed message text for retry.
   * Since textContent is gone, we must parse the bytes on-demand.
   */
  async recoverFailedMessage(messageId: string): Promise<string | undefined> {
    const targetMsg = this._rawMessages().find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.payloadBytes) return undefined;

    let textToRestore: string | undefined;
    try {
      const parsed = this.contentParser.parse(
        targetMsg.typeId,
        targetMsg.payloadBytes,
      );
      if (parsed.kind === 'content' && parsed.payload.kind === 'text') {
        textToRestore = parsed.payload.text;
      }
    } catch (e) {
      // ignore parse error
    }

    await this.storage.deleteMessage(messageId);
    this._rawMessages.update((msgs) => msgs.filter((m) => m.id !== messageId));
    return textToRestore;
  }

  async performHistoryWipe(): Promise<void> {
    this.selectedConversation.set(null);
    this._rawMessages.set([]);
    this.genesisReached.set(false);
    this.firstUnreadId.set(null);
    this._persistedConversations.set([]);

    // Safety: Iterate to handle deletion regardless of underlying storage implementation details
    const convos = await this.historyReader.getAllConversations();
    await Promise.all(
      convos.map((c) => (this.storage as any).deleteConversation(c.id)),
    );

    this.logger.info('[ConversationService] Local history wiped.');
  }

  // --- INTERNAL HELPERS ---

  async reloadMessages(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const freshMessages = await Promise.all(
      ids.map((id) => this.storage.getMessage(id)),
    );
    const valid = freshMessages.filter((m): m is ChatMessage => !!m);
    if (valid.length > 0) {
      this.upsertMessages(valid);
    }
  }

  upsertMessages(messages: ChatMessage[]): void {
    const selectedConversation = this.selectedConversation();
    if (!selectedConversation) return;

    const relevant = messages.filter((msg) =>
      msg.conversationUrn.equals(selectedConversation.id),
    );

    if (relevant.length > 0) {
      this.processReadReceipts(relevant).catch((err) =>
        this.logger.warn('Failed to process live receipts', err),
      );

      this._rawMessages.update((current) => {
        const lookup = new Map(current.map((m) => [m.id, m]));
        relevant.forEach((m) => lookup.set(m.id, m));
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

  async applyIncomingReadReceipts(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.reloadMessages(ids);
  }

  private async loadSmartHistory(query: HistoryQuery) {
    return this.historyReader.getMessages(query);
  }

  private async processReadReceipts(messages: ChatMessage[]): Promise<void> {
    const myUrn = this.sessionService.snapshot.networkUrn;
    const unreadMessages = messages.filter(
      (m) => !m.senderId.equals(myUrn) && m.status !== 'read',
    );
    if (unreadMessages.length === 0) return;

    const ids = unreadMessages.map((m) => m.id);
    const idSet = new Set(ids);

    this._rawMessages.update((current) =>
      current.map((msg) =>
        idSet.has(msg.id) ? { ...msg, status: 'read' } : msg,
      ),
    );

    await this.storage.updateMessageStatus(ids, 'read');
    this.readReceiptTrigger$.next(ids);
  }

  private setLocalUnreadCount(urn: URN, count: number): void {
    this._persistedConversations.update((list) =>
      list.map((c) => (c.id.equals(urn) ? { ...c, unreadCount: count } : c)),
    );
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
