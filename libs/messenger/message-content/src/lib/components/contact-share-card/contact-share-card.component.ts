// libs/messenger/message-content/src/lib/components/contact-share-card/contact-share-card.component.ts

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ContactSharePayload } from '../../models/content-types';

@Component({
  selector: 'messenger-contact-share-card',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './contact-share-card.component.html',
  styleUrl: './contact-share-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactShareCardComponent {
  data = input.required<ContactSharePayload>();
  
  /** Emits when the user clicks "View" or "Add" */
  action = output<string>(); // Emits the URN string

  get initials(): string {
    // Simple initial extractor from alias
    return this.data().alias.slice(0, 2).toUpperCase();
  }

  onAction(): void {
    this.action.emit(this.data().urn);
  }
}