// libs/messenger/chat-ui/src/lib/chat-conversation-list-item/chat-conversation-list-item.component.ts

import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ContactAvatarComponent } from '@nx-platform-application/contacts-ui';

@Component({
  selector: 'chat-conversation-list-item',
  standalone: true,
  imports: [CommonModule, ContactAvatarComponent, DatePipe],
  templateUrl: './chat-conversation-list-item.component.html',
  styleUrl: './chat-conversation-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'button',
    tabindex: '0',
    '(click)': 'select.emit()',
    '(keydown.enter)': 'select.emit()',
    '(keydown.space)': 'select.emit($event.preventDefault())',
  },
})
export class ChatConversationListItemComponent {
  name = input.required<string>();
  latestMessage = input.required<string>();
  timestamp = input.required<string>();
  initials = input.required<string>();
  profilePictureUrl = input<string | undefined>(undefined);
  unreadCount = input<number>(0);
  isActive = input<boolean>(false);

  select = output<void>();
}
