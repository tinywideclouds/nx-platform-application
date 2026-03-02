import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'llm-typing-indicator',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-1.5 px-2 py-3 h-8">
      <div
        class="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
        style="animation-delay: 0ms"
      ></div>
      <div
        class="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
        style="animation-delay: 150ms"
      ></div>
      <div
        class="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
        style="animation-delay: 300ms"
      ></div>
    </div>
  `,
  styles: [
    `
      /* Tailwind's default bounce is a bit aggressive for a typing indicator. 
       This custom animation smooths it out to match iMessage/Signal. */
      .animate-bounce {
        animation: smooth-bounce 1.4s infinite ease-in-out both;
      }

      @keyframes smooth-bounce {
        0%,
        80%,
        100% {
          transform: scale(0);
          opacity: 0.5;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
      }
    `,
  ],
})
export class LlmTypingIndicatorComponent {}
