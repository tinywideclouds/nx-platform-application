import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export type ChatWindowMode = 'chat' | 'details';

export interface HeaderParticipant {
  name: string;
  initials: string;
  pictureUrl?: string;
}

export type HeaderGroupType = 'local' | 'network' | null;

@Component({
  selector: 'messenger-chat-window-header',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './chat-window-header.component.html',
  styleUrl: './chat-window-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowHeaderComponent {
  title = input.required<string>();
  icon = input<HeaderParticipant | null>(null);
  mode = input<ChatWindowMode>('chat');
  hasKeyIssue = input(false);

  // Single source of truth for group state
  // null = P2P (User)
  // 'local' = Contact Group
  // 'network' = Messenger Group
  groupType = input<HeaderGroupType>(null);

  back = output<void>();
  toggleInfo = output<void>();

  fork = output<void>(); // [+] Use as template
  broadcast = output<void>(); // [share] Blast message

  initials = computed(() => {
    const i = this.icon();
    if (i?.initials) return i.initials;
    return this.title().substring(0, 2).toUpperCase();
  });
}
