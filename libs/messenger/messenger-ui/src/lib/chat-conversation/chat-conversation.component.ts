// libs/messenger/messenger-ui/src/lib/chat-conversation/chat-conversation.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  inject,
  signal,
  effect,
  computed,
} from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ChatService } from '@nx-platform-application/chat-state';
import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatMessageBubbleComponent,
  ChatMessageDividerComponent,
  ChatTypingIndicatorComponent,
} from '@nx-platform-application/chat-ui';
import { ChatMessage } from '@nx-platform-application/messenger-types';

@Component({
  selector: 'messenger-chat-conversation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    AutoScrollDirective,
    ChatMessageBubbleComponent,
    ChatMessageDividerComponent,
    ChatTypingIndicatorComponent,
  ],
  providers: [DatePipe], // +Provider for manual formatting if needed, or just usage in template
  templateUrl: './chat-conversation.component.html',
  styleUrl: './chat-conversation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationComponent {
  private chatService = inject(ChatService);
  private snackBar = inject(MatSnackBar);

  @ViewChild('autoScroll') autoScroll!: AutoScrollDirective;

  messages = this.chatService.messages;
  currentUserUrn = this.chatService.currentUserUrn;
  selectedConversation = this.chatService.selectedConversation;
  isLoading = this.chatService.isLoadingHistory;

  // Connect to the service signal we created in Step 1
  firstUnreadId = this.chatService.firstUnreadId;

  typingActivity = this.chatService.typingActivity;

  // Timer for the "5 second timeout" logic
  // We use a simple interval signal to force re-evaluation of the computed
  now = toSignal(interval(1000), { initialValue: Date.now() });

  // UI State for the "New Messages" TTL
  showNewMessageIndicator = signal(false);

  messageControl = new FormControl('', { nonNullable: true });

  constructor() {
    // TTL LOGIC: When a new boundary is identified, show it, then fade it out.
    effect((onCleanup) => {
      const id = this.firstUnreadId();
      if (id) {
        this.showNewMessageIndicator.set(true);

        const timer = setTimeout(() => {
          this.showNewMessageIndicator.set(false);
        }, 60_000); // 60 Seconds TTL

        onCleanup(() => clearTimeout(timer));
      }
    });

    // SENDER LOGIC: Watch input changes
    this.messageControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((val) => {
        if (val && val.length > 0) {
          this.chatService.notifyTyping(); // Delegate to Service (which throttles)
        }
      });
  }

  // RECEIVER LOGIC: Computed Visibility
  showTypingIndicator = computed(() => {
    const urn = this.selectedConversation();
    if (!urn) return false;

    const activityMap = this.typingActivity();
    const lastActive = activityMap.get(urn.toString());

    if (!lastActive) return false;

    // Check 1: Is it recent? (User stopped typing 5s ago)
    const isRecent = Date.now() - lastActive < 5000;

    // Check 2: We rely on `now()` signal to force this check every second
    // (Optimization: In a real app, we might use a purely CSS animation fade-out
    // or a specialized timer to avoid global intervals, but this is robust for V1).
    this.now(); // Dependency

    return isRecent;
  });

  isMyMessage = (msg: any): boolean => {
    const myUrn = this.currentUserUrn();
    return !!myUrn && msg?.senderId?.toString() === myUrn.toString();
  };

  /**
   * Helper to determine if we should show a DATE divider.
   * Logic: Show if it's the first message OR if the day changed from the previous message.
   */
  shouldShowDateDivider(msg: ChatMessage, index: number): boolean {
    if (index === 0) return true;

    const prevMsg = this.messages()[index - 1];
    const currDate = msg.sentTimestamp.split('T')[0];
    const prevDate = prevMsg.sentTimestamp.split('T')[0];

    return currDate !== prevDate;
  }

  /**
   * Helper to determine if we should show the NEW MESSAGES divider.
   */
  shouldShowNewMessagesDivider(msg: ChatMessage): boolean {
    return this.showNewMessageIndicator() && msg.id === this.firstUnreadId();
  }

  onAlertVisibility(show: boolean): void {
    if (show) {
      const msgs = this.messages();
      const latestMessage = msgs[msgs.length - 1];
      if (latestMessage) {
        const messageText = latestMessage.textContent || 'New Message';
        this.showNewMessageToast(messageText);
      }
    } else {
      this.snackBar.dismiss();
    }
  }

  onSendMessage(): void {
    const text = this.messageControl.value.trim();
    const recipientUrn = this.selectedConversation();

    if (text && recipientUrn) {
      this.chatService.sendMessage(recipientUrn, text);
      this.messageControl.reset();
    }
  }

  private showNewMessageToast(content: string): void {
    const snippet =
      content.length > 30 ? content.slice(0, 30) + '...' : content;

    const snackBarRef = this.snackBar.open(`New: "${snippet}"`, 'Scroll Down', {
      duration: 8000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });

    snackBarRef.onAction().subscribe(() => {
      this.autoScroll.scrollToBottom('smooth');
    });
  }
}
