import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ChatService } from '@nx-platform-application/chat-state';
import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';

@Component({
  selector: 'messenger-chat-conversation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    AutoScrollDirective,
  ],
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

  messageControl = new FormControl('', { nonNullable: true });

  // Predicate: Does this message belong to me?
  isMyMessage = (msg: any): boolean => {
    const myUrn = this.currentUserUrn();
    return !!myUrn && msg?.senderId?.toString() === myUrn.toString();
  };

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
