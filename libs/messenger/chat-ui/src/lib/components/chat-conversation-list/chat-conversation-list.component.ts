// libs/messenger/chat-ui/src/lib/chat-conversation-list/chat-conversation-list.component.ts

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatConversationListItemComponent } from '../chat-conversation-list-item/chat-conversation-list-item.component';

/**
 * A "View Model" representing a single item in the conversation list.
 * This is what the "smart" parent component must provide.
 */
export type ConversationViewItem = {
  id: string; // The conversation URN string
  name: string;
  latestMessage: string;
  timestamp: string;
  initials: string;
  profilePictureUrl?: string;
  unreadCount: number;
  isActive: boolean;
};

@Component({
  selector: 'chat-conversation-list',
  standalone: true,
  imports: [CommonModule, ChatConversationListItemComponent],
  templateUrl: './chat-conversation-list.component.html',
  styleUrl: './chat-conversation-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationListComponent {
  /**
   * The list of items to display.
   */
  @Input({ required: true }) items!: ConversationViewItem[];

  /**
   * Emits the unique ID (conversation URN string) of the selected conversation.
   */
  @Output() conversationSelected = new EventEmitter<string>();

  onSelect(item: ConversationViewItem): void {
    this.conversationSelected.emit(item.id);
  }
}