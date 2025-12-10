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
import { Temporal } from '@js-temporal/polyfill';

// DOMAIN STATE & LOGIC
import { ChatService } from '@nx-platform-application/chat-state';
import {
  MessageContentParser,
  ContentPayload,
} from '@nx-platform-application/message-content';
import { ChatMessage } from '@nx-platform-application/messenger-types';

// UI COMPONENTS
import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatMessageBubbleComponent,
  ChatMessageDividerComponent,
  ChatTypingIndicatorComponent,
  MessageRendererComponent, // The new Dumb Renderer
} from '@nx-platform-application/chat-ui';

// View Model: Enhances the ChatMessage with the parsed payload
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
    AutoScrollDirective,
    ChatMessageBubbleComponent,
    ChatMessageDividerComponent,
    ChatTypingIndicatorComponent,
    MessageRendererComponent,
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

  // Signal for Input (No Reactive Forms)
  messageText = signal('');
  showNewMessageIndicator = signal(false);

  // Timer for Typing Indicators (using Temporal)
  now = toSignal(interval(1000).pipe(map(() => Temporal.Now.instant())), {
    initialValue: Temporal.Now.instant(),
  });

  // --- COMPUTED VIEW MODEL ---
  // The crucial bridge between Raw Data and Dumb UI
  messagesVM = computed<MessageViewModel[]>(() => {
    return this.rawMessages().map((msg) => {
      let contentPayload: ContentPayload | null = null;

      // SAFETY CHECK: Ensure bytes exist
      if (msg.payloadBytes) {
        const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);

        // Filter: We only render 'content', not signals
        if (parsed.kind === 'content') {
          contentPayload = parsed.payload;
        }
      }
      // Optional: Handle missing bytes logic (maybe return a specialized 'error' payload?)

      return {
        ...msg,
        contentPayload,
      };
    });
  });

  constructor() {
    // TTL Logic for New Message Divider
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

  showTypingIndicator = computed(() => {
    const urn = this.selectedConversation();
    if (!urn) return false;

    const activityMap = this.typingActivity();
    const lastActive = activityMap.get(urn.toString()); // lastActive is Temporal.Instant

    if (!lastActive) return false;

    // Temporal Calculation
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

  onContentAction(urnString: string): void {
    // Smart component handles navigation
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
