import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip'; // ✅ Needed for the eyes
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';
import { ContactNamePipe } from '@nx-platform-application/contacts-ui';

import {
  ChatMessageBubbleComponent,
  ChatBubbleDirection,
} from '@nx-platform-application/messenger-ui-chat';
import { MessageRendererComponent } from '../message-renderer/message-renderer.component';

@Component({
  selector: 'chat-conversation-row',
  standalone: true,
  imports: [
    CommonModule,
    MatTooltipModule,
    ChatMessageBubbleComponent,
    MessageRendererComponent,
    ContactNamePipe,
  ],
  templateUrl: './chat-conversation-row.component.html',
  styleUrl: './chat-conversation-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationRowComponent {
  // --- Inputs ---
  message = input.required<ChatMessage>();
  isMine = input.required<boolean>();
  readCursors = input<URN[]>([]); // ✅ NEW: Parent passes the list of URNs

  // ... (Other inputs: isBroadcast, isGhost, etc. remain the same)
  isBroadcast = input(false);
  isGhost = input(false);
  statusTooltip = input('');

  // ... (Outputs remain the same)
  action = output<string>();
  acceptInvite = output<ChatMessage>();
  rejectInvite = output<ChatMessage>();
  retry = output<void>();

  // ... (Layout Logic remains the same)
  private layoutType = computed<'start' | 'center' | 'end'>(() => {
    const typeId = this.message().typeId.toString();
    const mine = this.isMine();
    if (typeId.includes('system')) return 'center';
    if (typeId.includes('group-invite') && mine) return 'center';
    return mine ? 'end' : 'start';
  });

  layoutClass = computed(() => {
    switch (this.layoutType()) {
      case 'center':
        return 'justify-center';
      case 'end':
        return 'justify-end';
      default:
        return 'justify-start';
    }
  });

  direction = computed<ChatBubbleDirection>(() => {
    if (this.layoutType() === 'center') return 'inbound';
    return this.isMine() ? 'outbound' : 'inbound';
  });

  isSystem = computed(() => this.layoutType() === 'center');
}
