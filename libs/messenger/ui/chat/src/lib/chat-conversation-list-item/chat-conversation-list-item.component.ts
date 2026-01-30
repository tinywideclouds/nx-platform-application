import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ContactAvatarComponent } from '@nx-platform-application/contacts-ui';
import { UIConversation } from '@nx-platform-application/messenger-state-chat-data';

@Component({
  selector: 'chat-conversation-list-item',
  standalone: true,
  imports: [CommonModule, DatePipe, ContactAvatarComponent],
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
  // ONE INPUT
  item = input.required<UIConversation>();

  select = output<void>();
}
