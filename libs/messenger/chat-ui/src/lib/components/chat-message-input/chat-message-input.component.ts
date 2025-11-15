// libs/messenger/chat-ui/src/lib/chat-message-input/chat-message-input.component.ts

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  inject,
  OnChanges,
  SimpleChanges,
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
export class ChatMessageInputComponent implements OnChanges {
  @Input() disabled: boolean = false;
  @Output() messageSent = new EventEmitter<string>();

  private fb = inject(FormBuilder);
  
  form = this.fb.group({
    messageText: ['', [Validators.required]],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['disabled']) {
      if (this.disabled) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    }
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
    if (this.form.invalid || this.disabled) {
      return;
    }

    const message = this.form.value.messageText?.trim();
    if (message) {
      this.messageSent.emit(message);
      this.form.reset();
    }
  }
}