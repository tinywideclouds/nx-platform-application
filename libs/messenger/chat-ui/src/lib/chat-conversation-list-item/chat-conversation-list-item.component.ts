// libs/messenger/chat-ui/src/lib/chat-conversation-list-item/chat-conversation-list-item.component.ts

import {
  Component,
  Input,
  Output,
  EventEmitter,
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
  // --- NEW, SIMPLER API ---
  @Input({ required: true }) name!: string;
  @Input({ required: true }) latestMessage!: string;
  @Input({ required: true }) timestamp!: string;
  @Input({ required: true }) initials!: string;
  @Input() profilePictureUrl?: string;
  @Input() unreadCount: number = 0;
  @Input() isActive: boolean = false;
  // --- END NEW API ---

  @Output() select = new EventEmitter<void>();

  @HostListener('click')
  onHostClick(): void {
    this.select.emit();
  }
}