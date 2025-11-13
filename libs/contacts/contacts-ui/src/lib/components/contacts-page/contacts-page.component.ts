// libs/contacts/contacts-ui/src/lib/contacts-page/contacts-page.component.ts

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-data-access';
import { ContactListComponent } from '../contact-list/contact-list.component';

@Component({
  selector: 'lib-contacts-page',
  standalone: true,
  imports: [CommonModule, ContactListComponent], // Import our "dumb" list
  templateUrl: './contacts-page.component.html',
  styleUrl: './contacts-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPageComponent {
  // 1. Inject the data access service
  private contactsService = inject(ContactsStorageService);

  // 2. Convert the observable to a signal for reactive, zoneless binding.
  //    Provide an initialValue to ensure it's always an array.
  contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [],
  });

  /**
   * 3. Handle the output event from the "dumb" list.
   * (This is where you would trigger navigation, open a detail pane, etc.)
   */
  onContactSelect(contact: Contact): void {
    console.log('Contact selected in smart component:', contact.id);
    // Future logic (e.g., this.router.navigate(...))
  }
}