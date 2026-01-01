// libs/messenger/chat-ui/src/lib/chat-message-input/chat-message-input.component.ts

import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';

@Component({
  selector: 'chat-message-input',
  standalone: true,
  imports: [], // REFACTOR: No ReactiveFormsModule needed
  templateUrl: './chat-message-input.component.html',
  styleUrl: './chat-message-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageInputComponent {
  disabled = input(false);
  messageSent = output<string>();

  // REFACTOR: Pure Signal State
  messageText = signal('');

  // REFACTOR: Handle keydown manually (Enter vs Shift+Enter)
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent new line
      this.sendMessage();
    }
  }

  // REFACTOR: Native Input Handler
  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.messageText.set(target.value);
  }

  sendMessage(): void {
    // 1. Check disabled signal
    if (this.disabled()) return;

    // 2. Read signal
    const message = this.messageText().trim();

    if (message) {
      this.messageSent.emit(message);
      // 3. Reset signal
      this.messageText.set('');
    }
  }
}
