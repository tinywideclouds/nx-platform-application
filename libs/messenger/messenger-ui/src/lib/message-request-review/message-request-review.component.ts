import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PendingIdentity } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';

@Component({
  selector: 'messenger-message-request-review',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatTooltipModule,
  ],
  templateUrl: './message-request-review.component.html',
  styleUrl: './message-request-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageRequestReviewComponent {
  // --- INPUTS ---
  requests = input.required<PendingIdentity[]>();

  /**
   * Content for the "Peek" functionality.
   * Key: Identity URN string. Value: List of messages.
   */
  previewMessages = input<Record<string, ChatMessage[]>>({});

  /**
   * Track which URNs are currently loading (for the spinner).
   */
  loadingPreviews = input<Set<string>>(new Set());

  // --- OUTPUTS ---

  /** User wants to peek at the messages for this sender */
  peek = output<URN>();

  /** User wants to create a real contact (Accept) */
  accept = output<URN>();

  /** User wants to block this specific sender */
  block = output<{ urn: URN; scope: 'messenger' | 'all' }>();

  /** User wants to dismiss this request (Delete without blocking) */
  dismiss = output<URN>();

  /** User wants to block EVERYONE in the list */
  blockAll = output<void>();

  // --- STATE ---
  expandedUrn = signal<string | null>(null);

  onPanelOpened(urn: URN) {
    this.expandedUrn.set(urn.toString());
  }

  getMessagesFor(urn: URN): ChatMessage[] {
    return this.previewMessages()[urn.toString()] || [];
  }
}
