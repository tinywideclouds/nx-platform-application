// libs/messenger/chat-ui/src/lib/chat-conversation-list/chat-conversation-list.component.ts

import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';

// THE SINGLE TRUTH
import { UIConversation } from '@nx-platform-application/messenger-state-chat-data';

import { ChatConversationListItemComponent } from '../chat-conversation-list-item/chat-conversation-list-item.component';

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
   * The list of items to display (UIConversation directly).
   */
  items = input.required<UIConversation[]>();

  /**
   * Emits the unique ID (conversation URN string) of the selected conversation.
   */
  conversationSelected = output<URN>();

  onSelect(item: UIConversation): void {
    this.conversationSelected.emit(item.id);
  }
}
