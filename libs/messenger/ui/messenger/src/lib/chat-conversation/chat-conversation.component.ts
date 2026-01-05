// libs/messenger/chat-ui/src/lib/chat-conversation/chat-conversation.component.ts

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

// DOMAIN STATE & LOGIC
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import {
  ChatMessage,
  ChatParticipant,
} from '@nx-platform-application/messenger-types';
import {
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_GROUP_INVITE,
} from '@nx-platform-application/messenger-domain-message-content';

// UI COMPONENTS
import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatMessageBubbleComponent,
  ChatMessageDividerComponent,
  ChatTypingIndicatorComponent,
  MessageRendererComponent,
  ChatInviteMessageComponent, // ✅ New Import
  InviteViewModel, // ✅ New Import
} from '@nx-platform-application/messenger-ui-chat';
import { ChatInputComponent } from '../chat-input/chat-input.component'; // ✅ New Import

import { ContactNamePipe } from '@nx-platform-application/contacts-ui';

@Component({
  selector: 'messenger-chat-conversation',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    AutoScrollDirective,
    ChatMessageBubbleComponent,
    ChatMessageDividerComponent,
    ChatTypingIndicatorComponent,
    MessageRendererComponent,
    ChatInviteMessageComponent,
    ChatInputComponent,
    ContactNamePipe,
  ],
  providers: [DatePipe],
  templateUrl: './chat-conversation.component.html',
  styleUrl: './chat-conversation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationComponent {
  private chatService = inject(ChatService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  // --- SIGNALS ---
  autoScroll = viewChild.required<AutoScrollDirective>('autoScroll');

  // We use the raw messages now to allow the @switch to see the real typeId
  chatMessages = this.chatService.messages;

  currentUserUrn = this.chatService.currentUserUrn;
  selectedConversation = this.chatService.selectedConversation;
  isLoading = this.chatService.isLoadingHistory;
  firstUnreadId = this.chatService.firstUnreadId;
  typingActivity = this.chatService.typingActivity;
  readCursors = this.chatService.readCursors;

  showNewMessageIndicator = signal(false);

  // Timer for Typing Indicators
  now = toSignal(interval(1000).pipe(map(() => Temporal.Now.instant())), {
    initialValue: Temporal.Now.instant(),
  });

  // --- CONSTANTS FOR TEMPLATE ---
  readonly MSG_TYPE_TEXT = MESSAGE_TYPE_TEXT;
  readonly MSG_TYPE_INVITE = MESSAGE_TYPE_GROUP_INVITE;

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

  // --- LOGIC ---

  getReadCursorsForMessage(msgId: string): URN[] {
    const map = this.readCursors();
    return map.get(msgId) || [];
  }

  showTypingIndicator = computed(() => {
    const urn = this.selectedConversation();
    if (!urn) return false;

    const activityMap = this.typingActivity();
    const lastActive = activityMap.get(urn.toString());

    if (!lastActive) return false;

    try {
      const duration = this.now().since(lastActive);
      return duration.total({ unit: 'millisecond' }) < 5000;
    } catch {
      return false;
    }
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

  /**
   * Safe ViewModel Factory for Invites.
   * Extracts group details from the payload for the Dumb Component.
   */
  getInviteViewModel(msg: ChatMessage): InviteViewModel {
    if (!msg.payloadBytes) {
      return { groupName: 'Unknown Group', groupUrn: '' };
    }
    try {
      const parsed = JSON.parse(new TextDecoder().decode(msg.payloadBytes));
      return {
        groupName: parsed.name || 'Unnamed Group',
        groupUrn: parsed.groupUrn || '',
      };
    } catch (e) {
      console.warn('Failed to parse invite payload', e);
      return { groupName: 'Corrupted Invite', groupUrn: '' };
    }
  }

  // --- ACTIONS ---

  async onRetryMessage(msg: ChatMessage): Promise<void> {
    if (msg.status !== 'failed') return;
    const restoredText = await this.chatService.recoverFailedMessage(msg.id);
    // TODO: Pass this text back to input if needed, or retry in place
    console.log('Retried message:', restoredText);
  }

  onContentAction(urnString: string): void {
    this.router.navigate(['/contacts/edit', urnString]);
  }

  onTyping(): void {
    this.chatService.notifyTyping();
  }

  onSendMessage(text: string): void {
    const recipient = this.selectedConversation();
    if (text && recipient) {
      this.chatService.sendMessage(recipient, text);
    }
  }

  async onAcceptInvite(msg: ChatMessage): Promise<void> {
    await this.chatService.acceptInvite(msg);
    const vm = this.getInviteViewModel(msg);
    if (vm.groupUrn) {
      this.router.navigate(['/messenger', 'conversations', vm.groupUrn]);
    }
  }

  async onRejectInvite(msg: ChatMessage): Promise<void> {
    await this.chatService.rejectInvite(msg);
  }

  onAlertVisibility(show: boolean): void {
    if (show) {
      const msgs = this.chatMessages();
      const latest = msgs[msgs.length - 1];
      if (latest?.textContent) {
        this.snackBar
          .open(`New: "${latest.textContent.slice(0, 30)}..."`, 'Scroll Down', {
            duration: 5000,
          })
          .onAction()
          .subscribe(() => this.autoScroll().scrollToBottom('smooth'));
      }
    } else {
      this.snackBar.dismiss();
    }
  }
}
