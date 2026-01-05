import {
  Component,
  ChangeDetectionStrategy,
  signal,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'messenger-chat-input',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <footer
      class="flex-shrink-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t bg-white z-10"
    >
      <div class="flex items-center space-x-2">
        <input
          type="text"
          [value]="messageText()"
          (input)="onInput($event)"
          (keydown.enter)="onSend()"
          placeholder="Type a message..."
          class="flex-grow p-3 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
        />
        <button
          type="button"
          title="Send"
          (click)="onSend()"
          [disabled]="!messageText().trim()"
          class="flex-shrink-0 p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <mat-icon class="!w-6 !h-6 text-[24px]">send</mat-icon>
        </button>
      </div>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInputComponent {
  send = output<string>();
  typing = output<void>();

  messageText = signal('');

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.messageText.set(val);
    if (val.length > 0) {
      this.typing.emit();
    }
  }

  onSend(): void {
    const text = this.messageText().trim();
    if (text) {
      this.send.emit(text);
      this.messageText.set('');
    }
  }
}
