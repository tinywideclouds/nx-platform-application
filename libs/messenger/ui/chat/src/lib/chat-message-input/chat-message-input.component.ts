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
  imports: [],
  templateUrl: './chat-message-input.component.html',
  styleUrl: './chat-message-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageInputComponent {
  disabled = input(false);
  messageSent = output<string>();

  // ✅ FIX: Restore the typing output so the parent's (typing)="onTyping()" works
  typing = output<void>();

  messageText = signal('');

  onKeyDown(event: KeyboardEvent): void {
    // ✅ FIX: Emit typing on keydown (catches all interactions)
    this.typing.emit();

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.messageText.set(target.value);

    // ✅ FIX: Emit typing when text changes
    this.typing.emit();
  }

  sendMessage(): void {
    if (this.disabled()) return;
    const message = this.messageText().trim();

    if (message) {
      this.messageSent.emit(message);
      this.messageText.set('');
    }
  }
}
