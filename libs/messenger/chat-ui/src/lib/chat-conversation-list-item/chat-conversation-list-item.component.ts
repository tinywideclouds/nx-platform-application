// libs/messenger/chat-ui/src/lib/chat-conversation-list-item/chat-conversation-list-item.component.ts

import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContactAvatarComponent } from '@nx-platform-application/contacts-ui';

@Component({
  selector: 'chat-conversation-list-item',
  standalone: true,
  imports: [CommonModule, ContactAvatarComponent],
  templateUrl: './chat-conversation-list-item.component.html',
  styleUrl: './chat-conversation-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationListItemComponent {
  // --- NEW SIGNALS API ---
  name = input.required<string>();
  latestMessage = input.required<string>();
  timestamp = input.required<string>();
  initials = input.required<string>();
  profilePictureUrl = input<string | undefined>(undefined); // Optional with default
  unreadCount = input<number>(0);
  isActive = input<boolean>(false);
  // --- END NEW API ---

  select = output<void>();

  @HostListener('click')
  onHostClick(): void {
    this.select.emit();
  }
}