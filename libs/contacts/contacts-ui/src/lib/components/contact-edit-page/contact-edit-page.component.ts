import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ContactsStorageService,
  Contact,
  ContactGroup, // 1. Import ContactGroup
} from '@nx-platform-application/contacts-data-access';
import { ContactFormComponent } from '../contact-form/contact-form.component';
import { toSignal, toObservable } from '@angular/core/rxjs-interop'; // 2. Import toObservable
import { map, switchMap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';

@Component({
  selector: 'lib-contact-edit-page',
  standalone: true,
  imports: [CommonModule, ContactFormComponent],
  templateUrl: './contact-edit-page.component.html',
  styleUrl: './contact-edit-page.component.scss',
})
export class ContactEditPageComponent {
  // 1. Inject services
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private contactsService = inject(
    ContactsStorageService
  ) as ContactsStorageService;

  // 2. Define private streams
  private id$: Observable<string | null> = this.route.paramMap.pipe(
    map((params) => params.get('id'))
  );

  private contactStream$: Observable<Contact | null> = this.id$.pipe(
    switchMap((id) => {
      // This stream reactively switches between "edit" and "new" mode
      return id ? this.getContact(id) : this.getNewContact();
    })
  );

  // 3. Convert the final stream to a public signal
  contactToEdit = toSignal(this.contactStream$, {
    initialValue: null as Contact | null,
  });

  // 4. --- NEW: Stream for Contact's Groups ---
  //    This stream automatically reacts to the contactToEdit signal changing.
  private groupsForContactStream$: Observable<ContactGroup[]> =
    toObservable(this.contactToEdit).pipe(
      switchMap((contact) => {
        if (!contact?.id) {
          // If no contact (e.g., "add" mode), return an empty array
          return of([] as ContactGroup[]);
        }
        // 'from' converts the Promise<ContactGroup[]> to an Observable
        return from(this.contactsService.getGroupsForContact(contact.id));
      })
    );

  // 5. --- NEW: Signal for Contact's Groups ---
  groupsForContact = toSignal(this.groupsForContactStream$, {
    initialValue: [] as ContactGroup[],
  });

  // --- Event Handlers ---

  async onSave(contact: Contact): Promise<void> {
    await this.contactsService.saveContact(contact);
    // 6. --- FIX: Navigate back to the 'contacts' tab ---
    this.router.navigate(['/contacts'], { queryParams: { tab: 'contacts' } });
  }

  onCancel(): void {
    // 7. --- FIX: Navigate back to the 'contacts' tab ---
    this.router.navigate(['/contacts'], { queryParams: { tab: 'contacts' } });
  }

  // --- Private Helper Methods ---

  /**
   * EDIT MODE: Returns a stream for an existing contact.
   */
  private getContact(id: string): Observable<Contact | null> {
    // `from` converts the Promise from getContact() into an Observable
    return from(this.contactsService.getContact(id)).pipe(
      map((contact) => contact ?? null) // Ensure undefined becomes null
    );
  }

  /**
   * ADD MODE: Returns a stream for a new, empty contact.
   */
  private getNewContact(): Observable<Contact> {
    // `of` creates an Observable that emits a single value
    return of({
      id: `urn:sm:user:${crypto.randomUUID()}`,
      alias: '',
      email: '',
      firstName: '',
      surname: '',
      phoneNumbers: [],
      emailAddresses: [],
      serviceContacts: {},
      isFavorite: false,
    });
  }
}