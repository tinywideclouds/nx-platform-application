import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonToggleModule } from '@angular/material/button-toggle'; // ✅ NEW
import { MatTooltipModule } from '@angular/material/tooltip'; // ✅ NEW

export type ChatWindowMode = 'chat' | 'details';
export type ChatScopeMode = 'local' | 'network'; // ✅ NEW

@Component({
  selector: 'messenger-chat-window-header',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatButtonToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './chat-window-header.component.html',
  styleUrl: './chat-window-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowHeaderComponent {
  title = input.required<string>();
  icon = input<{ initials: string; pictureUrl?: string } | null>(null);

  hasKeyIssue = input(false);

  // ✅ NEW: Slider State (Null = Hidden)
  scopeMode = input<ChatScopeMode | null>(null);

  /** Emitted when the user wants to navigate "up" or "back" */
  back = output<void>();

  /** Emitted when the user clicks the Info/Cog button */
  toggleInfo = output<void>();
}
