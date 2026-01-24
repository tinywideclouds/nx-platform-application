import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { ImageContent } from '@nx-platform-application/messenger-domain-message-content';
import {
  SafeResourceUrlPipe,
  SafeUrlPipe,
} from '@nx-platform-application/platform-ui-pipes';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'chat-image-message',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatBadgeModule,
    SafeResourceUrlPipe,
    SafeUrlPipe,
  ],
  templateUrl: './chat-image-message.component.html',
  styleUrls: ['./chat-image-message.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatImageMessageComponent {
  content = input.required<ImageContent & { messageId: string }>();

  private facade = inject(ChatMediaFacade);
  private snackBar = inject(MatSnackBar);

  // this is static for now - we may make this dependent on drive implementation
  preferDownload = true;

  isUpdatingThumbnail = signal(false);

  // The inline image is always used for display
  displaySrc = computed(() => this.content().inlineImage);

  private driveAsset = computed(() => {
    const assets = this.content().assets;
    // We cast to any because the key is dynamic, but we know we look for 'driveImage'
    return assets ? (assets as any).driveImage : null;
  });

  // --- NEW: CAPABILITIES ---
  // What can we do with this specific image? (e.g. Google supports all, Dropbox might support less)
  capabilities = computed(() => {
    const asset = this.driveAsset();
    if (!asset)
      return { canEmbed: false, canLinkExternal: false, canDownload: false };
    const providerCapabilities = this.facade.getCapabilities(asset.provider);
    return providerCapabilities;
  });

  // --- NEW: PREVIEW STATE ---
  // If set, we show the modal overlay with the iframe
  activePreviewUrl = signal<string | null>(null);

  async openPreview() {
    const asset = this.driveAsset();
    if (!asset) return;
    try {
      //TODO decide if we need drive driven preview choice - do we get bytes or use a preview from provider
      if (this.preferDownload) {
        const url = await this.facade.getDownload(
          asset.provider,
          asset.resourceId,
        );
        this.activePreviewUrl.set(url);
      } else {
        // DO NOT REMOVE - WE ARE STILL ASSESSING PREVIEW OPTIONS
        const url = await this.facade.getEmbedLink(
          asset.provider,
          asset.resourceId,
        );

        this.activePreviewUrl.set(url);
      }
    } catch (e) {
      console.error('Failed to open preview', e);
    }
  }

  // this is preview logic so we put it between the preview open/close methods
  async updateThumbnail() {
    const previewUrl = this.activePreviewUrl();
    const messageId = this.content().messageId;

    if (!messageId) {
      console.warn('no mesage id found cannot patch image');
    }

    if (!previewUrl || !messageId) return;

    this.isUpdatingThumbnail.set(true);

    try {
      // 1. Get the raw data from the current Blob URL
      // This is instant (browser memory)
      const blob = await fetch(previewUrl).then((r) => r.blob());

      // 2. Delegate to Facade
      await this.facade.upgradeInlineImage(messageId, blob);

      // Optional: Show success toast/notification here?
      this.snackBar.open('Inline image now hi-res', '', { duration: 2000 });
    } catch (e) {
      // Error handling
      this.snackBar.open('Could not upgrade inline image', '', {
        duration: 2000,
      });
    } finally {
      this.isUpdatingThumbnail.set(false);
    }
  }

  closePreview() {
    this.activePreviewUrl.set(null);
  }

  async downloadOriginal(event: MouseEvent) {
    event.stopPropagation();
    const asset = this.driveAsset();
    if (!asset) return;
    try {
      const url = await this.facade.getDownload(
        asset.provider,
        asset.resourceId,
      );

      // Trigger the download
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.filename || 'download';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download', e);
    }
  }

  async openExternal() {
    const asset = this.driveAsset();
    if (!asset) return;
    try {
      const url = await this.facade.getDriveLink(
        asset.provider,
        asset.resourceId,
      );
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Failed to open external link', e);
    }
  }

  // Checks if the 'original' asset exists in the record
  // This will flip from FALSE -> TRUE when the background patch arrives
  mediaLinks = computed(() => {
    const assets = this.content().assets;
    if (!assets) return false;

    const mediaMap = (assets as any).driveImage;
    // Check for your specific key. We used 'original' in the discussion.
    // Also ensuring 'assets' is not undefined/null
    return !!(assets && mediaMap);
  });

  altText = computed(() => this.content().displayName || 'Image Attachment');
}
