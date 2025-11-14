// libs/contacts/contacts-ui/src/lib/contact-list-item/contact-list-item.component.ts

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Contact } from '@nx-platform-application/contacts-data-access';
// Import the avatar component so our template can use it
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

@Component({
  selector: 'contacts-list-item',
  standalone: true,
  // Add ContactAvatarComponent to the imports array
  imports: [CommonModule, ContactAvatarComponent],
  templateUrl: './contact-list-item.component.html',
  styleUrl: './contact-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactListItemComponent {
  @Input({ required: true }) contact!: Contact;
  @Output() select = new EventEmitter<Contact>();

  @HostListener('click')
  onHostClick(): void {
    this.select.emit(this.contact);
  }

  // --- NEW LOGIC ---

  /**
   * Calculates the initials from the contact's name.
   */
  get initials(): string {
    const first = this.contact.firstName?.[0] || '';
    const last = this.contact.surname?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }

  /**
   * Finds the profile picture.
   * This is where we'll place the logic to decide WHICH service's
   * picture to show. For now, we'll hardcode 'messenger'.
   */
  get profilePictureUrl(): string | undefined {
    // This logic is now correctly placed in the list item,
    // not the avatar component.
    return this.contact.serviceContacts['messenger']?.profilePictureUrl;
  }
}