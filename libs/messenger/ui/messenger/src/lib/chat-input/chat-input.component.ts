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

  // ✅ UPDATED: Emit BOTH file (for upload) and payload (for preview)
  sendImage = output<{ file: File; payload: ImageContent }>();

  typing = output<void>();

  isProcessing = signal(false);
  pendingAttachment = signal<ImageContent | null>(null);
  private rawFile: File | null = null;

  async onFileSelected(file: File): Promise<void> {
    this.isProcessing.set(true);
    try {
      this.rawFile = file;
      const processed = await this.imageProcessor.process(file);

      const payload: ImageContent = {
        kind: 'image',
        thumbnailBase64: processed.thumbnailBase64,
        remoteUrl: 'pending', // Pending initially
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

  onRemoveAttachment(): void {
    this.pendingAttachment.set(null);
    this.rawFile = null;
  }

  /**
   * 3. Handle Final Submission (Fire and Forget)
   */
  async onSubmit(text?: string): Promise<void> {
    const attachment = this.pendingAttachment();
    const message = text?.trim();

    if (attachment && this.rawFile) {
      // ✅ Attach caption if present
      const finalPayload: ImageContent = {
        ...attachment,
        caption: message || undefined,
      };

      // ✅ EMIT: Hand off to smart service immediately
      this.sendImage.emit({ file: this.rawFile, payload: finalPayload });

      // Reset Input immediately (Optimistic UI)
      this.pendingAttachment.set(null);
      this.rawFile = null;
    } else if (message) {
      this.send.emit(message);
    }
  }
}
