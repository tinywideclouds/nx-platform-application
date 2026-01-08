import {
  Component,
  ChangeDetectionStrategy,
  output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageContent } from '@nx-platform-application/messenger-domain-message-content';
import { ChatMessageInputComponent } from '@nx-platform-application/messenger-ui-chat';
import { ImageProcessingService } from '@nx-platform-application/platform-tools-image-processing';

@Component({
  selector: 'messenger-chat-input',
  standalone: true,
  imports: [CommonModule, ChatMessageInputComponent],
  template: `
    <chat-message-input
      [disabled]="isProcessing()"
      [pendingAttachment]="pendingAttachment()"
      (typing)="typing.emit()"
      (imageSelected)="onFileSelected($event)"
      (attachmentRemoved)="onRemoveAttachment()"
      (submit)="onSubmit($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInputComponent {
  private imageProcessor = inject(ImageProcessingService);

  send = output<string>();
  sendImage = output<ImageContent>();
  typing = output<void>();

  isProcessing = signal(false);
  pendingAttachment = signal<ImageContent | null>(null);

  /**
   * 1. Handle Selection
   */
  async onFileSelected(file: File): Promise<void> {
    this.isProcessing.set(true);
    try {
      const processed = await this.imageProcessor.process(file);

      const payload: ImageContent = {
        kind: 'image',
        thumbnailBase64: processed.thumbnailBase64,
        remoteUrl: 'pending',
        decryptionKey: 'none',
        mimeType: file.type,
        width: processed.metadata.width,
        height: processed.metadata.height,
        sizeBytes: processed.metadata.previewSize,
        fileName: file.name,
      };

      this.pendingAttachment.set(payload);
    } catch (err) {
      console.error('Image processing failed', err);
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * 2. Handle Removal
   */
  onRemoveAttachment(): void {
    this.pendingAttachment.set(null);
  }

  /**
   * 3. Handle Final Submission
   * Triggered when user clicks Send or hits Enter
   */
  onSubmit(text?: string): void {
    const attachment = this.pendingAttachment();
    const message = text?.trim();

    // 1. Send Image
    if (attachment) {
      if (message) {
        attachment.caption = message;
      }
      this.sendImage.emit(attachment);
      this.pendingAttachment.set(null);
    }
    // 2. Send Text (Only if no image, or if separate logic needed)
    else if (message) {
      this.send.emit(message);
    }
  }
}
