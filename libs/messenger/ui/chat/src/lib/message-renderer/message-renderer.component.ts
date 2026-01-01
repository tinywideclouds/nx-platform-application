import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentPayload } from '@nx-platform-application/messenger-domain-message-content';
import { ContactShareCardComponent } from '../contact-share-card/contact-share-card.component';

@Component({
  selector: 'chat-message-renderer',
  standalone: true,
  imports: [CommonModule, ContactShareCardComponent],
  templateUrl: './message-renderer.component.html',
  styleUrl: './message-renderer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageRendererComponent {
  // Pure Input: Expects the fully parsed ContentPayload
  payload = input.required<ContentPayload | null>();

  // Pure Output: Emits actions (like "View Contact") for the parent to handle
  action = output<string>();
}
