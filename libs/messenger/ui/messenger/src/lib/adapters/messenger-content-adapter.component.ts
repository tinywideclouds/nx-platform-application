import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScrollItem,
  WeightUpdate,
} from '@nx-platform-application/scrollspace-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';

// Domain Components
import { ChatImageMessageComponent } from '@nx-platform-application/messenger-ui-chat';
import { ChatInviteMessageComponent } from '@nx-platform-application/messenger-ui-chat';
import { ChatTextRendererComponent } from '@nx-platform-application/messenger-ui-chat';
import { MessageContentPipe } from '../message-content.pipe';

@Component({
  selector: 'messenger-content-adapter',
  standalone: true,
  imports: [
    CommonModule,
    ChatImageMessageComponent,
    ChatInviteMessageComponent,
    ChatTextRendererComponent,
    MessageContentPipe,
  ],
  template: `
    @if (item().data | messageContent; as content) {
      @switch (content.kind) {
        @case ('image') {
          <chat-image-message
            [message]="content"
            (imageLoaded)="reportWeight(10)"
          />
        }

        @case ('text') {
          <div class="text-sm leading-relaxed px-1">
            <chat-text-renderer [parts]="content.parts" />
          </div>
        }

        @case ('action') {
          @if (content.action?.type === 'group-invite') {
            <messenger-chat-invite-message
              [payload]="content.action.actionMap"
              (accept)="accept.emit(item().data)"
              (reject)="reject.emit(item().data)"
            />
          }
        }

        @default {
          <div class="text-gray-500 italic text-xs">
            {{ content.parts[0]?.content || 'System Message' }}
          </div>
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerContentAdapterComponent {
  // The generic item from the library
  item = input.required<ScrollItem<ChatMessage>>();

  // Outputs required by Messenger Logic
  accept = output<ChatMessage>();
  reject = output<ChatMessage>();

  // Protocol: Weight Update back to Viewport
  weightUpdate = output<WeightUpdate>();

  reportWeight(weight: number) {
    this.weightUpdate.emit({
      itemId: this.item().id,
      newWeight: weight,
    });
  }
}
