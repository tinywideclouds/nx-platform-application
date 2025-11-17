import { Component, inject, signal, computed } from '@angular/core'; // Added computed
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
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
    MatChipsModule,
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
      return id ? this.getContact(id) : this.getNewContact();
    })
  );

  contactToEdit = toSignal(this.contactStream$, {
    initialValue: null as Contact | null,
  });

  // --- NEW: Fetch Linked Identities ---
  // We derive this stream from the contact signal.
  // Whenever the contact changes, we fetch its links.
  private linkedIdentitiesStream$: Observable<URN[]> = toObservable(
    this.contactToEdit
  ).pipe(
    switchMap((contact) => {
      if (!contact?.id) {
        return of([] as URN[]);
      }
      return from(this.contactsService.getLinkedIdentities(contact.id));
    })
  );

  linkedIdentities = toSignal(this.linkedIdentitiesStream$, {
    initialValue: [] as URN[],
  });
  // ------------------------------------

  private groupsForContactStream$: Observable<ContactGroup[]> =
    toObservable(this.contactToEdit).pipe(
      switchMap((contact) => {
        if (!contact?.id) {
          return of([] as ContactGroup[]);
        }
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
    try {
      const contactUrn = URN.parse(id);
      return from(this.contactsService.getContact(contactUrn)).pipe(
        map((contact) => contact ?? null)
      );
    } catch (error) {
      console.error('Invalid Contact URN in URL:', id, error);
      return of(null);
    }
  }

  /**
   * ADD MODE: Creates a new, empty contact.
   */
  private getNewContact(): Observable<Contact> {
    this.startInEditMode.set(true);
    return of({
      id: URN.create('user', crypto.randomUUID()),
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