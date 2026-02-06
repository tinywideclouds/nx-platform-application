import {
  Injectable,
  inject,
  signal,
  WritableSignal,
  computed,
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { URN } from '@nx-platform-application/platform-types';
import {
  Conversation,
  ChatMessage,
} from '@nx-platform-application/messenger-types';

// Services
import {
  ConversationService,
  ConversationActionService,
} from '@nx-platform-application/messenger-domain-conversation';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';

// Types
import {
  MessageGroupInvite,
  MessageGroupInviteResponse,
  MessageTypeSystem,
  ContactShareData,
  ImageContent,
} from '@nx-platform-application/messenger-domain-message-content';

@Injectable({ providedIn: 'root' })
export class ActiveChatFacade {
  private service = inject(ConversationService);
  private actions = inject(ConversationActionService);
  private ingestion = inject(IngestionService);
  private session = inject(SessionService);
  private groupProtocol = inject(GroupProtocolService);

  // --- STATE SIGNALS ---
  public readonly selectedConversation = signal<Conversation | null>(null);
  public readonly membershipStatus = signal<'joined' | 'invited' | 'unknown'>(
    'unknown',
  );

  public readonly isLoading = signal(false);
  // ALIAS: Required by AppStateService (Backward Compatibility)
  public readonly isLoadingHistory = this.isLoading;

  public readonly isRecipientKeyMissing = signal(false);
  public readonly firstUnreadId = signal<string | null>(null);
  public readonly genesisReached = signal(false);

  // Internal Store
  private readonly _rawMessages: WritableSignal<ChatMessage[]> = signal([]);

  // TRIGGER: Required by AppStateService to track read counts side-effects
  public readonly readReceiptTrigger$ = new Subject<string[]>();

  // --- COMPUTED VIEWS ---

  public readonly messages = computed(() => {
    const raw = this._rawMessages();
    const status = this.membershipStatus();
    const active = this.selectedConversation();
    const me = this.session.snapshot.networkUrn;

    if (active?.id.entityType !== 'group') return raw;
    if (status === 'joined') return raw;

    // If invited/unknown in a group, only show specific message types
    return raw.filter(
      (m) =>
        m.typeId.equals(MessageGroupInviteResponse) ||
        m.typeId.equals(MessageGroupInvite) ||
        m.typeId.equals(MessageTypeSystem) ||
        (me && m.senderId.equals(me)),
    );
  });

  public readonly readCursors = computed(() => {
    const msgs = this.messages();
    const me = this.session.snapshot.networkUrn;
    const active = this.selectedConversation();

    if (!me || !active || msgs.length === 0) return new Map<string, URN[]>();

    const cursors = new Map<string, URN[]>();
    const seenUsers = new Set<string>();
    const myUrnStr = me.toString();

    // Iterate backwards (Newest -> Oldest)
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];
      if (msg.receiptMap) {
        for (const [userId, status] of Object.entries(msg.receiptMap)) {
          if (
            status === 'read' &&
            userId !== myUrnStr &&
            !seenUsers.has(userId)
          ) {
            this.addCursor(cursors, msg.id, URN.parse(userId));
            seenUsers.add(userId);
          }
        }
      }
      // Implicit 1:1 Read Logic
      if (
        active.id.entityType === 'user' &&
        msg.senderId.equals(me) &&
        msg.status === 'read'
      ) {
        const partnerUrnStr = active.id.toString();
        if (!seenUsers.has(partnerUrnStr)) {
          this.addCursor(cursors, msg.id, active.id);
          seenUsers.add(partnerUrnStr);
        }
      }
    }
    return cursors;
  });

  constructor() {
    this.setupReactiveIngestion();
  }

  private setupReactiveIngestion() {
    this.ingestion.dataIngested$
      .pipe(takeUntilDestroyed())
      .subscribe(async (result) => {
        const activeUrn = this.selectedConversation()?.id;
        if (!activeUrn) return;

        const potentialIds = new Set([
          ...result.messages.map((m) => m.id),
          ...result.readReceipts,
          ...result.patchedMessageIds,
        ]);

        if (potentialIds.size === 0) return;

        // Reuse the public method to fetch and patch
        await this.refreshMessages(Array.from(potentialIds));
      });
  }

  // --- ACTIONS ---

  // PUBLIC API: Needed by ChatMediaFacade
  async refreshMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    const activeUrn = this.selectedConversation()?.id;
    if (!activeUrn) return;

    const freshData = await this.service.fetchMessages(messageIds);
    // Only keep messages belonging to CURRENT conversation
    const relevant = freshData.filter((m) =>
      m.conversationUrn.equals(activeUrn),
    );

    if (relevant.length > 0) {
      this.upsertMessages(relevant);
    }
  }

  async loadConversation(urn: URN | null): Promise<void> {
    if (!urn) {
      this.reset();
      return;
    }

    const current = this.selectedConversation();
    if (!current?.id.equals(urn)) {
      this.reset();
      this.isLoading.set(true);
    }

    try {
      const ctx = await this.service.loadContext(urn);

      this.selectedConversation.set(ctx.conversation);
      this._rawMessages.set(ctx.messages);
      this.membershipStatus.set(ctx.membershipStatus);
      this.genesisReached.set(ctx.genesisReached);
      this.isRecipientKeyMissing.set(ctx.isRecipientKeyMissing);
      this.firstUnreadId.set(ctx.firstUnreadId);

      this.processLocalRead(ctx.messages);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMoreMessages(): Promise<void> {
    if (this.isLoading() || this.genesisReached()) return;

    const urn = this.selectedConversation()?.id;
    const msgs = this._rawMessages();
    if (!urn || msgs.length === 0) return;

    this.isLoading.set(true);
    try {
      const oldestMsg = msgs[0];
      const olderMsgs = await this.service.loadMoreMessages(
        urn,
        oldestMsg.sentTimestamp,
      );

      if (olderMsgs.length > 0) {
        this._rawMessages.update((current) => [...olderMsgs, ...current]);
      } else {
        this.genesisReached.set(true);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async recoverFailedMessage(id: string): Promise<string | undefined> {
    const raw = this._rawMessages();
    const target = raw.find((m) => m.id === id);
    if (!target) return undefined;

    const text = await this.service.recoverFailedMessage(
      id,
      target.payloadBytes,
      target.typeId,
    );

    if (text) {
      // Optimistic delete from list
      this._rawMessages.update((msgs) => msgs.filter((m) => m.id !== id));
    }
    return text;
  }

  async performHistoryWipe(): Promise<void> {
    await this.service.performHistoryWipe();
    this.reset();
  }

  async startNewConversation(urn: URN, name: string): Promise<void> {
    await this.service.startNewConversation(urn, name);
  }

  // --- RESTORED GROUP ACTIONS ---

  async provisionNetworkGroup(
    localGroupUrn: URN,
    name: string,
  ): Promise<URN | null> {
    try {
      return await this.groupProtocol.provisionNetworkGroup(
        localGroupUrn,
        name,
      );
    } catch (e) {
      return null;
    }
  }

  async acceptGroupInvite(msg: ChatMessage): Promise<string> {
    return this.groupProtocol.acceptInvite(msg);
  }

  async rejectGroupInvite(msg: ChatMessage): Promise<void> {
    return this.groupProtocol.rejectInvite(msg);
  }

  // --- SEND ACTIONS ---

  async sendMessage(recipient: URN, text: string): Promise<void> {
    // Optimistic UI: We assume it works. The ingestion cycle will confirm/patch it later.
    const msg = await this.actions.sendMessage(recipient, text);
    this.upsertMessages([msg]);
  }

  async sendImage(recipient: URN, content: ImageContent): Promise<void> {
    const msg = await this.actions.sendImage(recipient, content);
    this.upsertMessages([msg]);
  }

  async sendTypingIndicator(recipient: URN): Promise<void> {
    await this.actions.sendTypingIndicator(recipient);
  }

  async sendContactShare(
    recipient: URN,
    data: ContactShareData,
  ): Promise<void> {
    const msg = await this.actions.sendContactShare(recipient, data);
    this.upsertMessages([msg]);
  }

  // --- HELPERS ---

  private upsertMessages(newMsgs: ChatMessage[]) {
    if (newMsgs.length === 0) return;

    this.processLocalRead(newMsgs);

    this._rawMessages.update((current) => {
      const map = new Map(current.map((m) => [m.id, m]));
      newMsgs.forEach((m) => map.set(m.id, m));
      return Array.from(map.values()).sort((a, b) =>
        a.sentTimestamp.localeCompare(b.sentTimestamp),
      );
    });
  }

  private processLocalRead(messages: ChatMessage[]) {
    const myUrn = this.session.snapshot.networkUrn;
    if (!myUrn) return;

    const currentUrn = this.selectedConversation()?.id;
    if (!currentUrn) return;

    const unreadIds = messages
      .filter((m) => !m.senderId.equals(myUrn) && m.status !== 'read')
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      this.actions.markMessagesAsRead(currentUrn, unreadIds);
      this.readReceiptTrigger$.next(unreadIds);
    }
  }

  private addCursor(map: Map<string, URN[]>, msgId: string, userUrn: URN) {
    if (!map.has(msgId)) map.set(msgId, []);
    map.get(msgId)!.push(userUrn);
  }

  private reset() {
    this.selectedConversation.set(null);
    this._rawMessages.set([]);
    this.membershipStatus.set('unknown');
    this.firstUnreadId.set(null);
    this.genesisReached.set(false);
    this.isRecipientKeyMissing.set(false);
  }
}
