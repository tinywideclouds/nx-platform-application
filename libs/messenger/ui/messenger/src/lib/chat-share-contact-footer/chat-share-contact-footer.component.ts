// libs/messenger/messenger-ui/src/lib/chat-share-contact-footer/chat-share-contact-footer.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  output,
  input,
} from '@angular/core';

import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { toSignal } from '@angular/core/rxjs-interop';

import { ContactsStorageService } from '@nx-platform-application/contacts-infrastructure-storage';
import { Contact } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';

@Component({
  selector: 'messenger-share-contact-footer',
  standalone: true,
  imports: [MatAutocompleteModule],
  templateUrl: './chat-share-contact-footer.component.html',
  styleUrl: './chat-share-contact-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatShareContactFooterComponent {
  private contactsService = inject(ContactsStorageService);

  contactToShare = input<URN>();
  share = output<URN>();

  // REFACTOR: Pure Signal State
  searchQuery = signal('');
  selectedRecipient = signal<Contact | null>(null);

  private allContacts = toSignal(this.contactsService.contacts$, {
    initialValue: [],
  });

  filteredContacts = computed(() => {
    const term = this.searchQuery().toLowerCase();
    const all = this.allContacts();
    const ignoreId = this.contactToShare()?.toString();

    // 1. If we have a selected recipient, we might want to hide the list
    // or just show that one. But usually, filtering continues based on text.

    return all.filter((c) => {
      // Don't show the person we are currently viewing/sharing
      if (c.id.toString() === ignoreId) return false;

      return (
        c.alias.toLowerCase().includes(term) ||
        c.firstName.toLowerCase().includes(term) ||
        c.surname.toLowerCase().includes(term)
      );
    });
  });

  // Used by MatAutocomplete to display the object as a string
  displayFn(contact: Contact): string {
    return contact ? contact.alias : '';
  }

  // REFACTOR: Handle Native Input
  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    this.searchQuery.set(value);

    // If user types manually, they are breaking the "Selection" link
    this.selectedRecipient.set(null);
  }

  // REFACTOR: Handle Autocomplete Selection
  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const contact = event.option.value as Contact;

    // 1. Store the object
    this.selectedRecipient.set(contact);

    // 2. Update the text field to match the friendly name
    this.searchQuery.set(contact.alias);
  }

  onSend(): void {
    const recipient = this.selectedRecipient();
    if (recipient) {
      this.share.emit(recipient.id);

      // Reset State
      this.searchQuery.set('');
      this.selectedRecipient.set(null);
    }
  }
}
