// libs/messenger/chat-ui/src/lib/chat-typing-indicator/chat-typing-indicator.component.ts

import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'chat-typing-indicator',
  standalone: true,
  imports: [],
  template: `
    <div
      class="flex items-center space-x-1 bg-gray-100 rounded-2xl px-4 py-3 w-fit"
    >
      <div class="dot bg-gray-400 w-2 h-2 rounded-full animate-bounce"></div>
      <div
        class="dot bg-gray-400 w-2 h-2 rounded-full animate-bounce delay-75"
      ></div>
      <div
        class="dot bg-gray-400 w-2 h-2 rounded-full animate-bounce delay-150"
      ></div>
    </div>
  `,
  styles: [
    `
      .delay-75 {
        animation-delay: 75ms;
      }
      .delay-150 {
        animation-delay: 150ms;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatTypingIndicatorComponent {}
