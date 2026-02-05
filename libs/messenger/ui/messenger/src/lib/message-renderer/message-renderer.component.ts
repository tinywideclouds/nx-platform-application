import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MessageContentPipe } from '../message-content.pipe';
import {
  ChatImageMessageComponent,
  ChatSystemMessageComponent,
  ChatTextRendererComponent,
  ChatInviteMessageComponent,
} from '@nx-platform-application/messenger-ui-chat';

import { ContactNamePipe } from '@nx-platform-application/contacts-ui';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'chat-message-renderer',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    ChatImageMessageComponent,
    ChatSystemMessageComponent,
    ChatTextRendererComponent,
    ChatInviteMessageComponent,
    MessageContentPipe,
    ContactNamePipe,
  ],
  templateUrl: './message-renderer.component.html',
  styleUrl: './message-renderer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageRendererComponent {
  message = input.required<ChatMessage>();
  isMine = input<boolean>(false);

  action = output<string>();
  acceptInvite = output<ChatMessage>();
  rejectInvite = output<ChatMessage>();

  // ✅ Helper to check if we should downgrade an Action to a System Message
  // (e.g., Sender viewing their own Invite)
  shouldRenderAsSystem = computed(() => {
    return this.isMine(); // For now, if it's mine, it's always system-style
  });

  onLinkClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href && href.startsWith('urn:')) {
        event.preventDefault();
        this.action.emit(href);
      }
    }
  }
}
