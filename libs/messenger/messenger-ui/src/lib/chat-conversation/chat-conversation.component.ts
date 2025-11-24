// libs/messenger/messenger-ui/src/lib/chat-conversation/chat-conversation.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ChatService } from '@nx-platform-application/chat-state';

@Component({
  selector: 'messenger-chat-conversation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-conversation.component.html',
  styleUrl: './chat-conversation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationComponent implements AfterViewChecked {
  private chatService = inject(ChatService);

  @ViewChild('messageContainer')
  private messageContainer!: ElementRef;

  // State from Service
  messages = this.chatService.messages;
  currentUserUrn = this.chatService.currentUserUrn;
  selectedConversation = this.chatService.selectedConversation;

  // Refactor: Use FormControl for explicit reactivity
  messageControl = new FormControl('', { nonNullable: true });

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.messageContainer) {
        this.messageContainer.nativeElement.scrollTop =
          this.messageContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      // Ignore init errors
    }
  }

  onSendMessage(): void {
    const text = this.messageControl.value.trim();
    const recipientUrn = this.selectedConversation();

    if (text && recipientUrn) {
      this.chatService.sendMessage(recipientUrn, text);
      this.messageControl.reset();
      this.scrollToBottom();
    }
  }
}