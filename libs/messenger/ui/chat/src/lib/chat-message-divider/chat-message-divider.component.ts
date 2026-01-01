// libs/messenger/chat-ui/src/lib/chat-message-divider/chat-message-divider.component.ts

import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DividerType = 'date' | 'new-messages';

@Component({
  selector: 'chat-message-divider',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-center my-6 opacity-90">
      <div
        class="h-px flex-1 transition-colors duration-300"
        [ngClass]="type() === 'new-messages' ? 'bg-red-200' : 'bg-gray-200'"
      ></div>

      <div
        class="mx-4 px-3 py-1 rounded-full text-xs font-medium shadow-sm border transition-colors duration-300"
        [ngClass]="
          type() === 'new-messages'
            ? 'bg-red-50 text-red-600 border-red-100'
            : 'bg-white text-gray-500 border-gray-200'
        "
      >
        {{ label() }}
      </div>

      <div
        class="h-px flex-1 transition-colors duration-300"
        [ngClass]="type() === 'new-messages' ? 'bg-red-200' : 'bg-gray-200'"
      ></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageDividerComponent {
  label = input.required<string | undefined>();
  type = input<DividerType>('date');
}
