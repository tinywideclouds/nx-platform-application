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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Domain / UI Imports
import { SafeUrlPipe } from '@nx-platform-application/platform-ui-pipes';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { DisplayMessage } from '../models';
import { ChatTextRendererComponent } from '../chat-text-renderer/chat-text-renderer.component';

@Component({
  selector: 'chat-image-message',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    SafeUrlPipe,
    ChatTextRendererComponent,
  ],
  templateUrl: './chat-image-message.component.html',
  styleUrls: ['./chat-image-message.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatImageMessageComponent {
  message = input.required<DisplayMessage>();

  private facade = inject(ChatMediaFacade);
  private snackBar = inject(MatSnackBar);

  // --- STATE ---
  isLightboxOpen = signal(false);
  isUpdatingThumbnail = signal(false);
  activePreviewUrl = signal<string | null>(null);
  isLoadingPreview = signal(false);

  // --- COMPUTED HELPERS ---
  private imgData = computed(() => this.message().image!);
  parts = computed(() => this.message().parts);
  displaySrc = computed(() => this.imgData().src);

  // Heuristic: If base64 string > 20KB, it's likely the 720px HD version
  isHd = computed(() => (this.displaySrc()?.length || 0) > 20_000);

  // Layout Helpers
  aspectRatio = computed(() => {
    const { width, height } = this.imgData();
    if (!width || !height) return '1 / 1';
    return `${width} / ${height}`;
  });

  private driveAsset = computed(() => {
    const assets = this.imgData().assets;
    return assets ? (assets as any).driveImage : null;
  });

  // Only show badge if we have the asset link AND we haven't upgraded yet
  showHdBadge = computed(() => !!this.driveAsset() && !this.isHd());
  mediaLinks = computed(() => !!this.driveAsset());

  capabilities = computed(() => {
    const asset = this.driveAsset();
    if (!asset)
      return { canEmbed: false, canLinkExternal: false, canDownload: false };
    return this.facade.getCapabilities(asset.provider);
  });

  // --- ACTIONS ---

  async openPreview() {
    // 1. If we already have the HD version inline, use it immediately.
    // ✅ FIX: Set the activePreviewUrl so the template renders the "Sharp" version
    if (this.isHd()) {
      this.activePreviewUrl.set(this.displaySrc());
      this.isLightboxOpen.set(true);
      return;
    }

    // 2. Otherwise, fetch from cloud
    const asset = this.driveAsset();
    if (!asset) {
      // Fallback: Open lightbox with whatever blurred thumbnail we have
      this.isLightboxOpen.set(true);
      return;
    }

    this.isLightboxOpen.set(true);
    this.isLoadingPreview.set(true);

    try {
      const url = await this.facade.getDownload(
        asset.provider,
        asset.resourceId,
      );
      this.activePreviewUrl.set(url);
    } catch (e) {
      this.snackBar.open('Failed to load full image', 'Close', {
        duration: 3000,
      });
    } finally {
      this.isLoadingPreview.set(false);
    }
  }

  closePreview() {
    this.isLightboxOpen.set(false);
    this.activePreviewUrl.set(null);
  }

  async updateThumbnail() {
    const messageId = this.message().id;
    if (!messageId) return;

    this.isUpdatingThumbnail.set(true);

    try {
      // 1. Get URL (either from cache or request it)
      let previewUrl = this.activePreviewUrl();
      if (!previewUrl) {
        const asset = this.driveAsset();
        if (asset) {
          previewUrl = await this.facade.getDownload(
            asset.provider,
            asset.resourceId,
          );
        }
      }

      if (!previewUrl) throw new Error('No source available');

      // 2. Fetch Blob
      const blob = await fetch(previewUrl).then((r) => r.blob());

      // 3. Delegate to Facade (Resize & Patch)
      await this.facade.upgradeInlineImage(messageId, blob);

      this.snackBar.open('Saved to chat', '', { duration: 2000 });
    } catch (e) {
      this.snackBar.open('Upgrade failed', '', { duration: 2000 });
    } finally {
      this.isUpdatingThumbnail.set(false);
    }
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
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.filename || 'download.png';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
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
      console.error('Failed to open external', e);
    }
  }
}
