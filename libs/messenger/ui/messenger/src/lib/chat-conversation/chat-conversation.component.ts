import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  effect,
  computed,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval, Subject, asyncScheduler } from 'rxjs';
import { map, throttleTime } from 'rxjs/operators';
import { CommonModule, DatePipe } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Temporal } from '@js-temporal/polyfill';

// ✅ STATE LAYERS
import { ActiveChatFacade } from '@nx-platform-application/messenger-state-active-chat';
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';

import {
  ChatMessage,
  DraftMessage,
} from '@nx-platform-application/messenger-types';
import {
  messageTagBroadcast,
  TEXT_MESSAGE_TYPE,
  IMAGE_MESSAGE_TYPE,
  GROUP_INVITE_TYPE,
} from '@nx-platform-application/messenger-domain-message-content';

import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatMessageDividerComponent,
  ChatTypingIndicatorComponent,
  ChatMessageInputComponent,
} from '@nx-platform-application/messenger-ui-chat';

import { ChatConversationRowComponent } from '../chat-conversation-row/chat-conversation-row.component';

@Component({
  selector: 'messenger-chat-conversation',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    AutoScrollDirective,
    ChatMessageDividerComponent,
    ChatTypingIndicatorComponent,
    ChatMessageInputComponent,
    ChatConversationRowComponent,
  ],
  providers: [DatePipe],
  templateUrl: './chat-conversation.component.html',
  styleUrl: './chat-conversation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationComponent {
  // --- INJECTIONS ---
  private activeChat = inject(ActiveChatFacade);
  private chatData = inject(ChatDataService);
  private mediaFacade = inject(ChatMediaFacade);
  private identityFacade = inject(ChatIdentityFacade);
  private destroyRef = inject(DestroyRef);

  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  autoScroll = viewChild.required<AutoScrollDirective>('autoScroll');

  // --- STATE SIGNALS ---
  chatMessages = this.activeChat.messages;
  currentUserUrn = this.identityFacade.myUrn;
  selectedConversation = this.activeChat.selectedConversation;
  isLoading = this.activeChat.isLoading;
  firstUnreadId = this.activeChat.firstUnreadId;
  readCursors = this.activeChat.readCursors;

  // ✅ Global Typing Data (Nested Map)
  typingActivity = this.chatData.typingActivity;

  // Local UI State
  showNewMessageIndicator = signal(false);

  // Constants
  readonly TEXT_MESSAGE = TEXT_MESSAGE_TYPE;
  readonly IMAGE_MESSAGE = IMAGE_MESSAGE_TYPE;
  readonly GROUP_INVITE_MESSAGE = GROUP_INVITE_TYPE;

  // Throttling Trigger
  private readonly typingTrigger$ = new Subject<void>();

  private secondPulse = toSignal(
    interval(1000).pipe(map(() => Temporal.Now.instant())),
    { initialValue: Temporal.Now.instant() },
  );

  constructor() {
    effect((onCleanup) => {
      const id = this.firstUnreadId();
      if (id) {
        this.showNewMessageIndicator.set(true);
        const timer = setTimeout(() => {
          this.showNewMessageIndicator.set(false);
        }, 60_000);
        onCleanup(() => clearTimeout(timer));
      }
    });

    // ✅ Typing Throttler
    this.typingTrigger$
      .pipe(
        throttleTime(3000, asyncScheduler, { leading: true, trailing: false }),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const recipient = this.selectedConversation()?.id;
        if (recipient) {
          this.activeChat.sendTypingIndicator(recipient);
        }
      });
  }

  // --- UI COMPUTED HELPERS ---

  getTypeId(msg: ChatMessage): string {
    return msg.typeId.entityId;
  }

  getReadCursorsForMessage(msgId: string) {
    const map = this.readCursors();
    return map.get(msgId) || [];
  }

  showTypingIndicator = computed(() => {
    const conversation = this.selectedConversation();
    if (!conversation) return false;

    const globalActivity = this.typingActivity();
    // ✅ FIX: Look up the specific conversation's activity map
    const conversationActivity = globalActivity.get(conversation.id.toString());

    if (!conversationActivity || conversationActivity.size === 0) return false;

    const _pulse = this.secondPulse(); // Reactivity trigger
    const now = Temporal.Now.instant();
    const myUrnStr = this.currentUserUrn()?.toString();

    // Scan for ANY active typist in this conversation
    for (const [userId, lastActive] of conversationActivity.entries()) {
      // Don't show my own typing (echo cancellation)
      if (userId === myUrnStr) continue;

      const diff = now.since(lastActive).total({ unit: 'seconds' });
      if (diff < 5) return true;
    }

    return false;
  });

  isMyMessage = (msg: ChatMessage): boolean => {
    const myUrn = this.currentUserUrn();
    return !!myUrn && msg.senderId.toString() === myUrn.toString();
  };

  shouldShowDateDivider(msg: ChatMessage, index: number): boolean {
    if (index === 0) return true;
    const prevMsg = this.chatMessages()[index - 1];
    const currDate = Temporal.Instant.from(msg.sentTimestamp)
      .toZonedDateTimeISO('UTC')
      .toPlainDate();
    const prevDate = Temporal.Instant.from(prevMsg.sentTimestamp)
      .toZonedDateTimeISO('UTC')
      .toPlainDate();
    return !currDate.equals(prevDate);
  }

  shouldShowNewMessagesDivider(msg: ChatMessage): boolean {
    return this.showNewMessageIndicator() && msg.id === this.firstUnreadId();
  }

  isBroadcast(msg: ChatMessage): boolean {
    return (
      msg.tags?.some((t) => t.toString() === messageTagBroadcast.toString()) ??
      false
    );
  }

  isGhost(msg: ChatMessage): boolean {
    return msg.status === 'reference';
  }

  getReceiptSummary(msg: ChatMessage): string {
    if (!this.isMyMessage(msg)) return '';
    if (msg.status === 'reference') return 'Sent via Broadcast';
    const map = msg.receiptMap;
    if (map && Object.keys(map).length > 0) {
      const total = Object.keys(map).length;
      const readCount = Object.values(map).filter((s) => s === 'read').length;
      return `Read by ${readCount} of ${total}`;
    }
    switch (msg.status) {
      case 'read':
        return 'Read';
      case 'delivered':
        return 'Delivered';
      case 'sent':
        return 'Sent to Server';
      case 'pending':
        return 'Sending...';
      case 'failed':
        return 'Failed to Send';
      default:
        return '';
    }
  }

  onAlertVisibility(show: boolean): void {
    if (show) {
      const msgs = this.chatMessages();
      const latest = msgs[msgs.length - 1];
      if (latest?.snippet) {
        this.snackBar
          .open(`New: "${latest.snippet}..."`, 'Scroll Down', {
            duration: 5000,
          })
          .onAction()
          .subscribe(() => this.autoScroll().scrollToBottom('smooth'));
      }
    } else {
      this.snackBar.dismiss();
    }
  }

  // --- ACTIONS ---

  onTyping(): void {
    this.typingTrigger$.next();
  }

  async onSendDraft(draft: DraftMessage): Promise<void> {
    const recipient = this.selectedConversation()?.id;
    if (!recipient) return;

    try {
      if (draft.attachments?.length) {
        const item = draft.attachments[0];
        await this.mediaFacade.sendImage(recipient, item.file, draft.text);
      } else if (draft.text?.trim()) {
        await this.activeChat.sendMessage(recipient, draft.text);
      }
    } catch (e) {
      this.snackBar.open('Failed to send message', 'Retry', { duration: 3000 });
    }
  }

  async onRetryMessage(msg: ChatMessage): Promise<void> {
    if (msg.status !== 'failed') return;
    await this.activeChat.recoverFailedMessage(msg.id);
  }

  onContentAction(urnString: string): void {
    this.router.navigate(['/contacts/edit', urnString]);
  }

  async onAcceptInvite(msg: ChatMessage): Promise<void> {
    try {
      const groupUrn = await this.activeChat.acceptGroupInvite(msg);
      if (groupUrn) {
        this.router.navigate(['/messenger', 'conversations', groupUrn]);
      }
    } catch (e) {
      this.snackBar.open('Failed to accept invite', 'OK', { duration: 3000 });
    }
  }

  async onRejectInvite(msg: ChatMessage): Promise<void> {
    await this.activeChat.rejectGroupInvite(msg);
  }
}
