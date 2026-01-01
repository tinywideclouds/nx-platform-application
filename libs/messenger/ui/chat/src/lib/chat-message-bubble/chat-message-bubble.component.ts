// libs/messenger/chat-ui/src/lib/chat-message-bubble/chat-message-bubble.component.ts

import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { MatIconModule } from '@angular/material/icon';
import { MessageDeliveryStatus } from '@nx-platform-application/messenger-types';

export type ChatBubbleDirection = 'inbound' | 'outbound';

@Component({
  selector: 'chat-message-bubble',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './chat-message-bubble.component.html',
  styleUrl: './chat-message-bubble.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageBubbleComponent {
  // REFACTOR: 'message' input removed in favor of content projection
  direction = input.required<ChatBubbleDirection>();
  timestamp = input<ISODateTimeString | string | undefined>(undefined);
  status = input<MessageDeliveryStatus | undefined>(undefined);
}
