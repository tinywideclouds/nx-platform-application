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
import {
  ConversationService,
  ConversationActionService,
} from '@nx-platform-application/messenger-domain-conversation';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import {
  MessageGroupInvite,
  MessageGroupInviteResponse,
  MessageTypeSystem,
  ContactShareData,
  ImageContent,
} from '@nx-platform-application/messenger-domain-message-content';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';

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
  public readonly isLoadingHistory = this.isLoading; // Alias for AppState compat

  public readonly isRecipientKeyMissing = signal(false);
  public readonly firstUnreadId = signal<string | null>(null);
  public readonly genesisReached = signal(false);

  public readonly readReceiptTrigger$ = new Subject<string[]>();

  // Internal Raw Store
  private readonly _rawMessages: WritableSignal<ChatMessage[]> = signal([]);

  // --- COMPUTED VIEWS ---

  public readonly messages = computed(() => {
    const raw = this._rawMessages();
    const status = this.membershipStatus();
    const urn = this.selectedConversation()?.id;
    const me = this.session.snapshot.networkUrn;

    if (urn?.entityType !== 'group') return raw;
    if (status === 'joined') return raw;

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

    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];

      if (msg.receiptMap) {
        for (const [userId, status] of Object.entries(msg.receiptMap)) {
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

  constructor() {
    // ✅ LISTENER: Incoming Data
    // "When the Domain ingests new messages, I check if they belong to my view."
    this.ingestion.dataIngested$
      .pipe(takeUntilDestroyed())
      .subscribe((result) => {
        const allChangedIds = [
          ...result.messages.map((m) => m.id),
          ...result.readReceipts,
          ...result.patchedMessageIds,
        ];
        if (allChangedIds.length > 0) {
          // If active, refresh view
          const currentUrn = this.selectedConversation()?.id;
          if (currentUrn) {
            // Logic to reload/patch messages for this URN
            this.loadConversation(currentUrn); // Simplest refresh
          }
        }
      });
  }

  // --- ACTIONS (Read / State) ---

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
      this._rawMessages.update((msgs) => msgs.filter((m) => m.id !== id));
    }
    return text;
  }

  async refreshMessages(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const fresh = await this.service.fetchMessages(ids);
    this.upsertMessages(fresh);
  }

  async performHistoryWipe(): Promise<void> {
    await this.service.performHistoryWipe();
    this.reset();
  }

  async startNewConversation(urn: URN, name: string): Promise<void> {
    await this.service.startNewConversation(urn, name);
  }

  // --- ACTIONS (Write / Sender) ---

  async sendMessage(recipient: URN, text: string): Promise<void> {
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
    const activeUrn = this.selectedConversation()?.id;
    if (!activeUrn) return;

    const relevant = newMsgs.filter((m) => m.conversationUrn.equals(activeUrn));
    if (relevant.length === 0) return;

    this.processLocalRead(relevant);

    this._rawMessages.update((current) => {
      const map = new Map(current.map((m) => [m.id, m]));
      relevant.forEach((m) => map.set(m.id, m));
      return Array.from(map.values()).sort((a, b) =>
        a.sentTimestamp.localeCompare(b.sentTimestamp),
      );
    });
  }

  private reset() {
    this.selectedConversation.set(null);
    this._rawMessages.set([]);
    this.membershipStatus.set('unknown');
    this.firstUnreadId.set(null);
    this.genesisReached.set(false);
    this.isRecipientKeyMissing.set(false);
  }

  private processLocalRead(messages: ChatMessage[]) {
    const myUrn = this.session.snapshot.networkUrn;
    if (!myUrn) return;

    // 1. Filter: Find messages that are visually unread
    const unreadIds = messages
      .filter((m) => !m.senderId.equals(myUrn) && m.status !== 'read')
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      const currentUrn = this.selectedConversation()?.id;

      if (currentUrn) {
        // ✅ THE TRUTH ESTABLISHED
        // The user has seen these messages. We execute the consequences in parallel.

        // Consequence A: Persistence (Updates Sidebar Badge)
        // Consequence B: Protocol (Updates Sender's UI)
        this.actions.markMessagesAsRead(currentUrn, unreadIds);

        // Consequence C: Internal State (Triggers any local UI effects)
        this.readReceiptTrigger$.next(unreadIds);
      }
    }
  }

  async provisionNetworkGroup(
    localGroupUrn: URN,
    name: string,
  ): Promise<URN | null> {
    try {
      const newUrn = await this.groupProtocol.provisionNetworkGroup(
        localGroupUrn,
        name,
      );
      // Optional: We could automatically load it here, but usually the UI navigates
      return newUrn;
    } catch (e) {
      // Log error in state layer
      return null;
    }
  }

  async acceptGroupInvite(msg: ChatMessage): Promise<string> {
    return this.groupProtocol.acceptInvite(msg);
  }

  async rejectGroupInvite(msg: ChatMessage): Promise<void> {
    return this.groupProtocol.rejectInvite(msg);
  }
}
