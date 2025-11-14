// libs/contacts/contacts-ui/src/lib/contact-edit-page/contact-edit-page.component.ts

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-data-access';
import { ContactFormComponent } from '../contact-form/contact-form.component';
import { toSignal } from '@angular/core/rxjs-interop';
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

  private contactsService = inject(ContactsStorageService) as ContactsStorageService;

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
  //    This perfectly matches your linter-approved pattern.
  contactToEdit = toSignal(this.contactStream$, {
    initialValue: null as Contact | null,
  });

  // --- Event Handlers ---

  async onSave(contact: Contact): Promise<void> {
    await this.contactsService.saveContact(contact);
    // Navigate away after save
    this.router.navigate(['/contacts']); // Or the previous page
  }

  onCancel(): void {
    // Navigate away on cancel
    this.router.navigate(['/contacts']); // Or the previous page
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