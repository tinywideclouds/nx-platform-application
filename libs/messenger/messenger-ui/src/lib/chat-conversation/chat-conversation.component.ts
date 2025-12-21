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
import { ChatService } from '@nx-platform-application/chat-state';
import {
  MessageContentParser,
  ContentPayload,
} from '@nx-platform-application/message-content';
import {
  ChatMessage,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';

// UI COMPONENTS
import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatMessageBubbleComponent,
  ChatMessageDividerComponent,
  ChatTypingIndicatorComponent,
  MessageRendererComponent,
} from '@nx-platform-application/chat-ui';

import { ContactNamePipe } from '@nx-platform-application/contacts-ui';

// View Model
type MessageViewModel = ChatMessage & {
  contentPayload: ContentPayload | null;
};

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
    ContactNamePipe,
  ],
  providers: [DatePipe],
  templateUrl: './chat-conversation.component.html',
  styleUrl: './chat-conversation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationComponent {
  private chatService = inject(ChatService);
  private parser = inject(MessageContentParser);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  // --- SIGNALS ---
  autoScroll = viewChild.required<AutoScrollDirective>('autoScroll');

  rawMessages = this.chatService.messages;
  currentUserUrn = this.chatService.currentUserUrn;
  selectedConversation = this.chatService.selectedConversation;
  isLoading = this.chatService.isLoadingHistory;
  firstUnreadId = this.chatService.firstUnreadId;
  typingActivity = this.chatService.typingActivity;
  readCursors = this.chatService.readCursors;

  // Signal for Input
  messageText = signal('');
  showNewMessageIndicator = signal(false);

  // Timer for Typing Indicators
  now = toSignal(interval(1000).pipe(map(() => Temporal.Now.instant())), {
    initialValue: Temporal.Now.instant(),
  });

  // --- COMPUTED VIEW MODEL ---
  messagesVM = computed<MessageViewModel[]>(() => {
    return this.rawMessages().map((msg) => {
      let contentPayload: ContentPayload | null = null;

      if (msg.payloadBytes) {
        const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);
        if (parsed.kind === 'content') {
          contentPayload = parsed.payload;
        }
      }

      return {
        ...msg,
        contentPayload,
      };
    });
  });

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
    const prevMsg = this.rawMessages()[index - 1];

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

  // --- ACTIONS ---

  async onRetryMessage(msg: MessageViewModel): Promise<void> {
    if (msg.status !== 'failed') return;

    // Delegate recovery to service
    const restoredText = await this.chatService.recoverFailedMessage(msg.id);

    if (restoredText) {
      this.messageText.set(restoredText);
    }
  }

  onContentAction(urnString: string): void {
    this.router.navigate(['/contacts/edit', urnString]);
  }

  onMessageInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.messageText.set(val);
    if (val.length > 0) this.chatService.notifyTyping();
  }

  onSendMessage(): void {
    const text = this.messageText().trim();
    const recipient = this.selectedConversation();

    if (text && recipient) {
      this.chatService.sendMessage(recipient, text);
      this.messageText.set('');
    }
  }

  onAlertVisibility(show: boolean): void {
    if (show) {
      const msgs = this.rawMessages();
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
