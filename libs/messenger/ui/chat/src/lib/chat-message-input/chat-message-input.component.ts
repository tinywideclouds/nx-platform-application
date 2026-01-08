import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common'; // For NgIf
import { MatIconModule } from '@angular/material/icon';
import { ImageContent } from '@nx-platform-application/messenger-domain-message-content';

@Component({
  selector: 'chat-message-input',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './chat-message-input.component.html',
  styleUrl: './chat-message-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageInputComponent {
  disabled = input(false);
  // ✅ NEW: Receive the preview data
  pendingAttachment = input<ImageContent | null>(null);

  messageSent = output<string>();
  typing = output<void>();
  imageSelected = output<File>();
  attachmentRemoved = output<void>();

  // ✅ NEW: Generic submit signal
  submit = output<string | undefined>();

  messageText = signal('');

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.imageSelected.emit(input.files[0]);
      input.value = ''; // Reset
    }
  }

  onRemoveAttachment(): void {
    this.attachmentRemoved.emit();
  }

  onSend(): void {
    if (this.disabled()) return;

    const text = this.messageText().trim();

    // Emit submit if we have text OR an attachment
    if (text || this.pendingAttachment()) {
      // We emit the text to the parent. The parent decides if it's a caption or a text msg.
      this.submit.emit(text || undefined);
      this.messageText.set(''); // Clear text
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    this.typing.emit();
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  onInput(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value;
    this.messageText.set(val);
    this.typing.emit();
  }
}
