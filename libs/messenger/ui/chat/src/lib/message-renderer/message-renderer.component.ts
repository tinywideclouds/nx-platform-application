import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentPayload } from '@nx-platform-application/messenger-domain-message-content';
import { ContactShareCardComponent } from '../contact-share-card/contact-share-card.component';
import { ChatImageMessageComponent } from '../chat-image-message/chat-image-message.component'; // ✅ Import

@Component({
  selector: 'chat-message-renderer',
  standalone: true,
  imports: [
    CommonModule,
    ContactShareCardComponent,
    ChatImageMessageComponent, // ✅ Register
  ],
  templateUrl: './message-renderer.component.html',
  styleUrl: './message-renderer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageRendererComponent {
  payload = input.required<ContentPayload | null>();
  action = output<string>();
}
