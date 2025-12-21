// libs/contacts/contacts-ui/src/lib/contact-multi-selector/contact-multi-selector.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  input,
  model,
  signal,
  computed,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Contact } from '@nx-platform-application/contacts-types';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';
// --- 1. URN import is no longer needed ---

@Component({
  selector: 'contacts-multi-selector',
  standalone: true,
  imports: [FormsModule, ContactAvatarComponent],
  templateUrl: './contact-multi-selector.component.html',
  styleUrl: './contact-multi-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactMultiSelectorComponent {
  // --- API ---

  /** All contacts available to select from. */
  allContacts = input.required<Contact[]>();

  /** The list of currently selected contact IDs (as strings). Binds two-way. */
  // --- 2. Change model to string[] ---
  selectedIds = model<string[]>([]);

  // --- Internal State ---

  /** The user's text in the filter input field. */
  filterText = signal('');

  /** A Set for fast lookups of selected IDs (as strings). */
  // --- 3. This is now a Set<string> ---
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
        contact.email.toLowerCase().includes(filter),
    );
  });

  // --- Methods ---

  /** Toggles the selection state for a single contact ID (as a string). */
  // --- 4. Change signature to accept string ---
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

  // --- 5. Add trackBy function ---
  trackContactById(index: number, contact: Contact): string {
    return contact.id.toString();
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
