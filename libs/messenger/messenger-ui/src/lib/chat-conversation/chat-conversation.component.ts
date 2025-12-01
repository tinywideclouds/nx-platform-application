// libs/messenger/messenger-ui/src/lib/chat-conversation/chat-conversation.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  inject,
  signal,
  effect,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // +DatePipe
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ChatService } from '@nx-platform-application/chat-state';
import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatMessageBubbleComponent,
  ChatMessageDividerComponent, // +Import
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
    ChatMessageDividerComponent, // +Usage
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
  }

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
