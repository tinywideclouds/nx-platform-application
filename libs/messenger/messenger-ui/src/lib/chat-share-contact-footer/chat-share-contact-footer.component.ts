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
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';

import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';

@Component({
  selector: 'messenger-share-contact-footer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
  ],
  templateUrl: './chat-share-contact-footer.component.html',
  styleUrl: './chat-share-contact-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatShareContactFooterComponent {
  private contactsService = inject(ContactsStorageService);

  contactToShare = input<URN>();
  share = output<URN>();

  searchControl = new FormControl<string | Contact>('');

  private searchText = toSignal(
    this.searchControl.valueChanges.pipe(startWith('')),
    { initialValue: '' }
  );

  private allContacts = toSignal(this.contactsService.contacts$, {
    initialValue: [],
  });

  filteredContacts = computed(() => {
    const rawValue = this.searchText();

    // FIX: Handle case where value is a Contact object (after selection)
    let term = '';
    if (typeof rawValue === 'string') {
      term = rawValue.toLowerCase();
    } else if (
      rawValue &&
      typeof rawValue === 'object' &&
      'alias' in rawValue
    ) {
      // If a contact is selected, we can either show all or filter by that contact.
      // Let's filter by the selected name to keep the view consistent.
      term = (rawValue as Contact).alias.toLowerCase();
    }

    const all = this.allContacts();
    const ignoreId = this.contactToShare()?.toString();

    return all.filter((c) => {
      if (c.id.toString() === ignoreId) return false;

      return (
        c.alias.toLowerCase().includes(term) ||
        c.firstName.toLowerCase().includes(term) ||
        c.surname.toLowerCase().includes(term)
      );
    });
  });

  selectedRecipient = signal<Contact | null>(null);

  displayFn(contact: Contact): string {
    return contact ? contact.alias : '';
  }

  onOptionSelected(event: any): void {
    this.selectedRecipient.set(event.option.value);
  }

  onSend(): void {
    const recipient = this.selectedRecipient();
    if (recipient) {
      this.share.emit(recipient.id);
      this.searchControl.setValue('');
      this.selectedRecipient.set(null);
    }
  }
}
