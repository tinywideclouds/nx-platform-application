import {
  Component,
  ChangeDetectionStrategy,
  input,
  model,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Contact } from '@nx-platform-application/contacts-data-access';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

@Component({
  selector: 'contacts-multi-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, ContactAvatarComponent],
  templateUrl: './contact-multi-selector.component.html',
  styleUrl: './contact-multi-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactMultiSelectorComponent {
  // --- API ---

  /** All contacts available to select from. */
  allContacts = input.required<Contact[]>();

  /** The list of currently selected contact IDs. Binds two-way. */
  selectedIds = model<string[]>([]);

  // --- Internal State ---

  /** The user's text in the filter input field. */
  filterText = signal('');

  /** A Set for fast lookups of selected IDs. */
  selectionSet = computed(() => new Set(this.selectedIds()));

  /** The list of contacts to render, based on the filter text. */
  filteredContacts = computed(() => {
    const all = this.allContacts();
    const filter = this.filterText().toLowerCase();

    if (!filter) {
      return all; // No filter, return all
    }

    return all.filter(
      (contact) =>
        contact.alias.toLowerCase().includes(filter) ||
        contact.firstName.toLowerCase().includes(filter) ||
        contact.surname.toLowerCase().includes(filter) ||
        contact.email.toLowerCase().includes(filter)
    );
  });

  // --- Methods ---

  /** Toggles the selection state for a single contact ID. */
  onToggleContact(id: string): void {
    const currentSet = new Set(this.selectedIds());
    if (currentSet.has(id)) {
      currentSet.delete(id);
    } else {
      currentSet.add(id);
    }
    // Update the model, which emits the change
    this.selectedIds.set(Array.from(currentSet));
  }

  /** Gets the initials for a given contact. */
  getInitials(contact: Contact): string {
    const first = contact.firstName?.[0] || '';
    const last = contact.surname?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }

  /** Gets the profile picture for a given contact. */
  getProfilePicture(contact: Contact): string | undefined {
    // Re-uses the same logic from ContactListItemComponent
    return contact.serviceContacts['messenger']?.profilePictureUrl;
  }
}