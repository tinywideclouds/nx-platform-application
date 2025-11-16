// libs/contacts/contacts-ui/src/lib/components/contact-page/contact-page.component.ts

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips'; // <-- 1. Import Chips module

import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
// --- 2. Import URN ---
import { URN } from '@nx-platform-application/platform-types';
import { ContactFormComponent } from '../contact-page-form/contact-form.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

@Component({
  selector: 'contacts-page',
  standalone: true,
  imports: [
    CommonModule,
    ContactFormComponent,
    MatButtonModule,
    MatIconModule,
    ContactsPageToolbarComponent,
    RouterLink,
    MatChipsModule, // <-- 3. Add Chips module
  ],
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.scss',
})
export class ContactPageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private contactsService = inject(
    ContactsStorageService
  ) as ContactsStorageService;

  startInEditMode = signal(false);

  // This is a string from the URL
  private id$: Observable<string | null> = this.route.paramMap.pipe(
    map((params) => params.get('id'))
  );

  private contactStream$: Observable<Contact | null> = this.id$.pipe(
    switchMap((id) => {
      // id is a string or null
      return id ? this.getContact(id) : this.getNewContact();
    })
  );

  contactToEdit = toSignal(this.contactStream$, {
    initialValue: null as Contact | null,
  });

  // This stream depends on the contact signal
  private groupsForContactStream$: Observable<ContactGroup[]> =
    toObservable(this.contactToEdit).pipe(
      switchMap((contact) => {
        // We MUST have a contact with a valid URN ID
        if (!contact?.id) {
          return of([] as ContactGroup[]);
        }
        // Pass the URN to the service
        return from(this.contactsService.getGroupsForContact(contact.id));
      })
    );

  groupsForContact = toSignal(this.groupsForContactStream$, {
    initialValue: [] as ContactGroup[],
  });

  async onSave(contact: Contact): Promise<void> {
    await this.contactsService.saveContact(contact);
    this.router.navigate(['/contacts'], { queryParams: { tab: 'contacts' } });
  }

  /**
   * EDIT MODE: Fetches an existing contact.
   * @param id The string ID from the URL.
   */
  private getContact(id: string): Observable<Contact | null> {
    this.startInEditMode.set(false);
    // --- 4. Parse the string ID to a URN ---
    try {
      const contactUrn = URN.parse(id);
      return from(this.contactsService.getContact(contactUrn)).pipe(
        map((contact) => contact ?? null)
      );
    } catch (error) {
      console.error('Invalid Contact URN in URL:', id, error);
      // TODO: Handle error, e.g., navigate to not-found
      return of(null);
    }
  }

  /**
   * ADD MODE: Creates a new, empty contact.
   */
  private getNewContact(): Observable<Contact> {
    this.startInEditMode.set(true);
    // --- 5. Create a valid URN for the new contact ---
    return of({
      id: URN.create('user', crypto.randomUUID()), // <-- Use URN object
      alias: '',
      email: '',
      firstName: '',
      surname: '',
      phoneNumbers: [],
      emailAddresses: [],
      serviceContacts: {},
    });
  }
}