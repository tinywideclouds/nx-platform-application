import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  effect,
  computed,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommonModule, DatePipe } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';

import { AppState } from '@nx-platform-application/messenger-state-app';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  messageTagBroadcast,
  TEXT_MESSAGE_TYPE,
  IMAGE_MESSAGE_TYPE,
  GROUP_INVITE_TYPE,
} from '@nx-platform-application/messenger-domain-message-content';

// Import Types
import { DraftMessage } from '@nx-platform-application/messenger-types';

import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatMessageDividerComponent,
  ChatTypingIndicatorComponent,
  ChatMessageInputComponent,
} from '@nx-platform-application/messenger-ui-chat';

// ✅ NEW IMPORT: The Row Component
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
  private appState = inject(AppState);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  autoScroll = viewChild.required<AutoScrollDirective>('autoScroll');

  chatMessages = this.appState.messages;
  currentUserUrn = this.appState.currentUserUrn;
  selectedConversation = this.appState.selectedConversation;
  isLoading = this.appState.isLoadingHistory;
  firstUnreadId = this.appState.firstUnreadId;
  typingActivity = this.appState.typingActivity;
  readCursors = this.appState.readCursors;

  showNewMessageIndicator = signal(false);

  now = toSignal(interval(1000).pipe(map(() => Temporal.Now.instant())), {
    initialValue: Temporal.Now.instant(),
  });

  readonly TEXT_MESSAGE = TEXT_MESSAGE_TYPE;
  readonly IMAGE_MESSAGE = IMAGE_MESSAGE_TYPE;
  readonly GROUP_INVITE_MESSAGE = GROUP_INVITE_TYPE;

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
  }

  getTypeId(msg: ChatMessage): string {
    return msg.typeId.entityId;
  }

  getReadCursorsForMessage(msgId: string): URN[] {
    const map = this.readCursors();
    return map.get(msgId) || [];
  }

  private secondPulse = toSignal(
    interval(1000).pipe(map(() => Temporal.Now.instant())),
    { initialValue: Temporal.Now.instant() },
  );
  /**
   * FIX: Correctly derives typing status from the Activity Map.
   * 1. Accesses .id.toString() instead of the object.
   * 2. Checks time diff to auto-hide after 5 seconds.
   */
  showTypingIndicator = computed(() => {
    const conversation = this.selectedConversation();
    const activityMap = this.typingActivity();
    const _pulse = this.secondPulse(); // Trigger re-calc every second

    if (!conversation) return false;

    // The map is keyed by User URNs.
    // In 1:1 chats, the Conversation ID IS the User URN.
    const key = conversation.id.toString();
    const lastActive = activityMap.get(key);

    if (!lastActive) return false;

    // Check expiry (5 seconds)
    const now = Temporal.Now.instant();
    const diff = now.since(lastActive).total({ unit: 'seconds' });

    return diff < 5;
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

  async onRetryMessage(msg: ChatMessage): Promise<void> {
    if (msg.status !== 'failed') return;
    await this.appState.recoverFailedMessage(msg.id);
  }

  onContentAction(urnString: string): void {
    this.router.navigate(['/contacts/edit', urnString]);
  }

  async onAcceptInvite(msg: ChatMessage): Promise<void> {
    try {
      const groupUrn = await this.appState.acceptInvite(msg);
      this.router.navigate(['/messenger', 'conversations', groupUrn]);
    } catch (e) {
      this.snackBar.open('Failed to accept invite', 'OK', { duration: 3000 });
    }
  }

  async onRejectInvite(msg: ChatMessage): Promise<void> {
    await this.appState.rejectInvite(msg);
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
    this.appState.notifyTyping();
  }

  /**
   * ✅ PURE DELEGATION
   * The UI just hands the draft to the State.
   * No logic here about checking files vs text.
   */
  onSendDraft(draft: DraftMessage): void {
    this.appState.sendDraft(draft);
  }
}
