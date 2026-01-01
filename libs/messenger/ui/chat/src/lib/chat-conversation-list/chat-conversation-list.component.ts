// libs/messenger/chat-ui/src/lib/chat-conversation-list/chat-conversation-list.component.ts

import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';

import { ChatConversationListItemComponent } from '../chat-conversation-list-item/chat-conversation-list-item.component';

/**
 * A "View Model" representing a single item in the conversation list.
 */
export type ConversationViewItem = {
  id: URN;
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
  imports: [ChatConversationListItemComponent],
  templateUrl: './chat-conversation-list.component.html',
  styleUrl: './chat-conversation-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationListComponent {
  /**
   * The list of items to display.
   */
  items = input.required<ConversationViewItem[]>();

  /**
   * Emits the unique ID (conversation URN string) of the selected conversation.
   */
  conversationSelected = output<URN>();

  onSelect(item: ConversationViewItem): void {
    this.conversationSelected.emit(item.id);
  }
}
