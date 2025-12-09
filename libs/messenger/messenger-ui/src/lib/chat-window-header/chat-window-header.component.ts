// libs/messenger/messenger-ui/src/lib/chat-window-header/chat-window-header.component.ts

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

import { ChatParticipant } from '@nx-platform-application/messenger-types';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';

export type ChatWindowMode = 'chat' | 'details';

@Component({
  selector: 'messenger-chat-window-header',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatBadgeModule],
  templateUrl: './chat-window-header.component.html',
  styleUrl: './chat-window-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowHeaderComponent {
  participant = input.required<ChatParticipant>();
  mode = input<ChatWindowMode>('chat');
  hasKeyIssue = input(false);

  /** Emitted when the user wants to navigate "up" or "back" */
  back = output<void>();
  
  /** Emitted when the user clicks the Info/Cog button */
  toggleInfo = output<void>();
}