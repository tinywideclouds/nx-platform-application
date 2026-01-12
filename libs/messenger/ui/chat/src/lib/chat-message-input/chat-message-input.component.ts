// libs/messenger/ui-chat/src/lib/chat-message-input/chat-message-input.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  signal,
  output,
  ElementRef,
  viewChild,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  AttachmentItem,
  DraftMessage,
} from '@nx-platform-application/messenger-types';

@Component({
  selector: 'chat-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule],
  templateUrl: './chat-message-input.component.html',
  styleUrl: './chat-message-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageInputComponent implements OnDestroy {
  // Outputs
  send = output<DraftMessage>();
  typing = output<void>();

  // Internal State
  text = signal('');
  attachments = signal<AttachmentItem[]>([]);

  // View Children
  fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  messageBox =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('messageBox');

  // Logic
  onInput(): void {
    this.adjustHeight();
    this.typing.emit();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Create lightweight preview locally
      const url = URL.createObjectURL(file);

      const newItem: AttachmentItem = {
        file: file,
        previewUrl: url,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      };

      // Add to list (supports future batching)
      this.attachments.update((items) => [...items, newItem]);

      // Reset input value so same file can be selected again if needed
      input.value = '';
    }
  }

  removeAttachment(index: number): void {
    this.attachments.update((items) => {
      const itemToRemove = items[index];
      // Clean up memory
      URL.revokeObjectURL(itemToRemove.previewUrl);
      return items.filter((_, i) => i !== index);
    });
  }

  onEnter(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.triggerSend();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    this.typing.emit();

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.triggerSend();
    }
  }

  canSend(): boolean {
    return this.text().trim().length > 0 || this.attachments().length > 0;
  }

  triggerSend(): void {
    if (!this.canSend()) return;

    const draft: DraftMessage = {
      text: this.text().trim(),
      attachments: this.attachments(),
    };

    this.send.emit(draft);
    this.reset();
  }

  private reset(): void {
    this.text.set('');

    // Revoke all URLs to free memory
    this.attachments().forEach((item) => URL.revokeObjectURL(item.previewUrl));
    this.attachments.set([]);

    // Reset height
    const textarea = this.messageBox().nativeElement;
    textarea.style.height = 'auto';
  }

  private adjustHeight(): void {
    const textarea = this.messageBox().nativeElement;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  ngOnDestroy(): void {
    // Safety cleanup
    this.attachments().forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }
}
