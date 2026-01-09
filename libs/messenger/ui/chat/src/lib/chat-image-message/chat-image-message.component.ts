import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImageContent } from '@nx-platform-application/messenger-domain-message-content';

@Component({
  selector: 'chat-image-message',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './chat-image-message.component.html',
  styleUrl: './chat-image-message.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatImageMessageComponent {
  // Pure Input: The specific ImageContent payload
  content = input.required<ImageContent>();

  // COMPUTED: Determine if we are in the "Optimistic/Uploading" state
  isPending = computed(() => this.content().remoteUrl === 'pending');

  // COMPUTED: Determine which source to show
  // If 'pending', we rely on the instant thumbnail.
  // Once the parent updates the payload with a real URL, this computed updates automatically.
  displaySrc = computed(() => {
    const c = this.content();
    // If pending, use thumbnail. Otherwise, use remote URL (with browser caching)
    return c.remoteUrl === 'pending' ? c.thumbnailBase64 : c.remoteUrl;
  });

  altText = computed(() => this.content().fileName || 'Image attachment');
}
