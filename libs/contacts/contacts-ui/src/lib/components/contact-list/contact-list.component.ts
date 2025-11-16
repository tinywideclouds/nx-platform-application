// libs/contacts/contacts-ui/src/lib/contact-list/contact-list.component.ts

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Contact } from '@nx-platform-application/contacts-data-access';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';

@Component({
  selector: 'contacts-list',
  standalone: true,
  imports: [CommonModule, ContactListItemComponent],
  templateUrl: './contact-list.component.html',
  styleUrl: './contact-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactListComponent {
  @Input({ required: true }) contacts!: Contact[];
  @Output() contactSelected = new EventEmitter<Contact>();

  onSelect(contact: Contact): void {
    this.contactSelected.emit(contact);
  }

  // --- 1. ADD THIS METHOD ---
  /**
   * Provides a stable, primitive value for Angular's @for loop tracking.
   */
  trackContactById(index: number, contact: Contact): string {
    return contact.id.toString(); // Convert URN to string for tracking
  }
}