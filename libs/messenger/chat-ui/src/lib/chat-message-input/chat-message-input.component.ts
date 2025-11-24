// libs/messenger/chat-ui/src/lib/chat-message-input/chat-message-input.component.ts

import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'chat-message-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-message-input.component.html',
  styleUrl: './chat-message-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageInputComponent {
  // 1. Convert to Signals
  disabled = input(false);
  messageSent = output<string>();

  private fb = inject(FormBuilder);
  
  form = this.fb.group({
    messageText: ['', [Validators.required]],
  });

  constructor() {
    // 2. Replace ngOnChanges with an effect
    effect(() => {
      if (this.disabled()) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    });
  }

  /**
   * Handles the keydown event to send on 'Enter' but
   * allow new lines with 'Shift+Enter'.
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent new line
      this.sendMessage();
    }
  }

  /**
   * Emits the message and resets the form.
   */
  sendMessage(): void {
    // 3. Update 'disabled' check to function call 'disabled()'
    if (this.form.invalid || this.disabled()) {
      return;
    }

    const message = this.form.value.messageText?.trim();
    if (message) {
      this.messageSent.emit(message);
      this.form.reset();
    }
  }
}