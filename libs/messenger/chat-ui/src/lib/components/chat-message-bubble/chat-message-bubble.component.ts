// libs/messenger/chat-ui/src/lib/chat-message-bubble/chat-message-bubble.component.ts

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ChatBubbleDirection = 'inbound' | 'outbound';

@Component({
  selector: 'chat-message-bubble',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-message-bubble.component.html',
  styleUrl: './chat-message-bubble.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageBubbleComponent {
  @Input({ required: true }) message!: string;
  @Input({ required: true }) direction: ChatBubbleDirection = 'inbound';
}