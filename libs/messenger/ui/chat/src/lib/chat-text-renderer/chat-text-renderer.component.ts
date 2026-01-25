import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessagePart } from '../models';

@Component({
  selector: 'chat-text-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @for (part of parts(); track $index) {
      @if (part.type === 'link') {
        <a
          [href]="part.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-500 underline hover:text-blue-700 transition-colors"
          (click)="$event.stopPropagation()"
        >
          {{ part.url }}
        </a>
      } @else {
        <span class="whitespace-pre-wrap">{{ part.content }}</span>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatTextRendererComponent {
  parts = input.required<MessagePart[]>();
}
