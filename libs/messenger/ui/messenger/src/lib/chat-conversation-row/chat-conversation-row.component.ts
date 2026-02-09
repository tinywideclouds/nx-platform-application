import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
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

  // ✅ NEW: Allows us to show names/colors for other people
  isGroup = input(false);

  readCursors = input<URN[]>([]);
  isBroadcast = input(false);
  isGhost = input(false);
  statusTooltip = input('');

  // --- Outputs ---
  action = output<string>();
  acceptInvite = output<ChatMessage>();
  rejectInvite = output<ChatMessage>();
  retry = output<void>();

  // --- Computed ---

  direction = computed<ChatBubbleDirection>(() => {
    if (this.isSystem()) return 'inbound'; // System messages center/left
    return this.isMine() ? 'outbound' : 'inbound';
  });

  isSystem = computed(() => {
    const typeId = this.message().typeId.toString();
    if (typeId.includes('system')) return true;
    if (typeId.includes('group-invite') && this.isMine()) return true;
    return false;
  });

  // Layout: 'Center' for system, 'End' for me, 'Start' for others
  layoutClass = computed(() => {
    if (this.isSystem()) return 'justify-center';
    return this.isMine() ? 'justify-end' : 'justify-start';
  });

  // ✅ Coloring Logic (Only for Group + Inbound)
  bubbleColor = computed(() => {
    if (this.isMine() || !this.isGroup() || this.isSystem()) return null;
    return this.getParticipantColor(this.message().senderId.toString());
  });

  // Stable Hash: URN -> Color Class
  private getParticipantColor(senderId: string): string {
    const colors = [
      'bg-red-50', // 0
      'bg-orange-50', // 1
      'bg-amber-50', // 2
      'bg-green-50', // 3
      'bg-emerald-50', // 4
      'bg-teal-50', // 5
      'bg-cyan-50', // 6
      'bg-sky-50', // 7
      'bg-indigo-50', // 8
      'bg-violet-50', // 9
      'bg-purple-50', // 10
      'bg-fuchsia-50', // 11
      'bg-pink-50', // 12
      'bg-rose-50', // 13
    ];

    let hash = 0;
    for (let i = 0; i < senderId.length; i++) {
      hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
}
