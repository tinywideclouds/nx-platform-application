import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge'; // <--- Add this
import { ImageContent } from '@nx-platform-application/messenger-domain-message-content';

@Component({
  selector: 'chat-image-message',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatBadgeModule], // <--- Add this
  templateUrl: './chat-image-message.component.html',
  styleUrls: ['./chat-image-message.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatImageMessageComponent {
  content = input.required<ImageContent>();

  // The inline image is always used for display
  displaySrc = computed(() => this.content().inlineImage);

  // Checks if the 'original' asset exists in the record
  // This will flip from FALSE -> TRUE when the background patch arrives
  hasOriginal = computed(() => {
    const assets = this.content().assets;
    // Check for your specific key. We used 'original' in the discussion.
    // Also ensuring 'assets' is not undefined/null
    return !!(assets && assets['original']);
  });

  altText = computed(() => this.content().displayName || 'Image Attachment');
}
