import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MessageDeliveryStatus } from '@nx-platform-application/messenger-types';

export type ChatBubbleDirection = 'inbound' | 'outbound';

@Component({
  selector: 'chat-message-bubble',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './chat-message-bubble.component.html',
  styleUrl: './chat-message-bubble.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageBubbleComponent {
  direction = input.required<ChatBubbleDirection>();
  timestamp = input<ISODateTimeString | string | undefined>(undefined);
  status = input<MessageDeliveryStatus | undefined>(undefined);

  // ✅ dumb inputs: Parent tells us what to show
  isBroadcast = input(false);
  isGhost = input(false);
  statusTooltip = input<string>('');
}
