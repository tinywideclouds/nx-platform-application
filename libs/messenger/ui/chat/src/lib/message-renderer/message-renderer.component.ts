// libs/messenger/ui-chat/src/lib/message-renderer/message-renderer.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentPayload } from '@nx-platform-application/messenger-domain-message-content';
import { ChatImageMessageComponent } from '../chat-image-message/chat-image-message.component';

@Component({
  selector: 'chat-message-renderer',
  standalone: true,
  imports: [CommonModule, ChatImageMessageComponent],
  templateUrl: './message-renderer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageRendererComponent {
  // The discriminated union (kind: 'text' | 'image')
  payload = input.required<ContentPayload | null>();

  // Emitted when user clicks a link or interacts with content (future proofing)
  action = output<string>();

  onLinkClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href?.startsWith('urn:')) {
        event.preventDefault();
        this.action.emit(href);
      }
    }
  }
}
