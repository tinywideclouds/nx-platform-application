import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MessageContentPipe } from '../message-content.pipe';
import {
  ChatImageMessageComponent,
  ChatTextRendererComponent,
} from '@nx-platform-application/messenger-ui-chat';

@Component({
  selector: 'chat-message-renderer',
  standalone: true,
  imports: [
    CommonModule,
    ChatImageMessageComponent,
    ChatTextRendererComponent,
    MessageContentPipe,
  ],
  templateUrl: './message-renderer.component.html',
  styleUrl: './message-renderer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageRendererComponent {
  // ✅ SOURCE OF TRUTH: The Full Message Object
  // This allows us to pass 'id', 'timestamp', 'senderId' to any child bubble that needs it.
  message = input.required<ChatMessage>();

  // Emitted when user clicks a special link (urn:...)
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
