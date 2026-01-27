import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'chat-system-message',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="flex items-center justify-center gap-2 py-2 opacity-70">
      <div
        class="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600 border border-gray-200"
      >
        @if (icon()) {
          <mat-icon class="!w-4 !h-4 text-[16px]">{{ icon() }}</mat-icon>
        }

        <span>
          <ng-content></ng-content>
        </span>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSystemMessageComponent {
  icon = input<string>();
}
