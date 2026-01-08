import {
  Component,
  ChangeDetectionStrategy,
  output,
  inject,
  signal,
  computed,
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
      (messageSent)="onSendText($event)"
      (typing)="typing.emit()"
      (imageSelected)="onFileSelected($event)"
      (attachmentRemoved)="onRemoveAttachment()"
      (submit)="onSubmit()"
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

  // ✅ NEW: Hold the image in state, don't send yet
  pendingAttachment = signal<ImageContent | null>(null);

  /**
   * 1. Handle Selection: Process & Store
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
   * 3. Handle Text Send (Legacy/Direct)
   */
  onSendText(text: string): void {
    // If we have an image, we handle it in onSubmit instead
    if (!this.pendingAttachment()) {
      this.send.emit(text);
    }
  }

  /**
   * 4. Handle Final Submission
   * Triggered when user clicks Send or hits Enter
   */
  onSubmit(text?: string): void {
    const attachment = this.pendingAttachment();
    const message = text?.trim();

    // Strategy: Send as two separate messages for now (Atomicity)
    // 1. Send Image
    if (attachment) {
      // If there is text, maybe attach it as caption?
      // For now, let's keep it simple: Image first.
      if (message) {
        attachment.caption = message; // Attach text as caption to image
      }
      this.sendImage.emit(attachment);
      this.pendingAttachment.set(null); // Clear state
    }
    // 2. Send Text (Only if no image, OR if we didn't use it as caption)
    else if (message) {
      this.send.emit(message);
    }
  }
}
