// libs/contacts/contacts-ui/src/lib/components/contact-edit-page/contact-edit-page.component.ts

import { Component, inject, signal } from '@angular/core'; // 1. signal imported
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router'; // 2. RouterLink imported
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { ContactFormComponent } from '../contact-page-form/contact-form.component';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
  ],
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.scss',
})
export class ContactPageComponent {
  // 1. Inject services
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private contactsService = inject(
    ContactsStorageService
  ) as ContactsStorageService;

  // 2. --- NEW: Signal for initial state ---
  startInEditMode = signal(false);

  // 3. Define private streams
  private id$: Observable<string | null> = this.route.paramMap.pipe(
    map((params) => params.get('id'))
  );

  private contactStream$: Observable<Contact | null> = this.id$.pipe(
    switchMap((id) => {
      // This stream reactively switches between "edit" and "new" mode
      return id ? this.getContact(id) : this.getNewContact();
    })
  );

  // 4. Convert the final stream to a public signal
  contactToEdit = toSignal(this.contactStream$, {
    initialValue: null as Contact | null,
  });

  // 5. --- Stream for Contact's Groups ---
  private groupsForContactStream$: Observable<ContactGroup[]> =
    toObservable(this.contactToEdit).pipe(
      switchMap((contact) => {
        if (!contact?.id) {
          return of([] as ContactGroup[]);
        }
        return from(this.contactsService.getGroupsForContact(contact.id));
      })
    );

  // 6. --- Signal for Contact's Groups ---
  groupsForContact = toSignal(this.groupsForContactStream$, {
    initialValue: [] as ContactGroup[],
  });

  // --- Event Handlers ---

  async onSave(contact: Contact): Promise<void> {
    await this.contactsService.saveContact(contact);
    // 7. --- SIMPLIFIED: Just navigate. Form will handle its own state. ---
    this.router.navigate(['/contacts'], { queryParams: { tab: 'contacts' } });
  }

  // 8. --- REMOVED: toggleEditMode() and onCancel() are no longer needed here ---

  // --- Private Helper Methods ---

  private getContact(id: string): Observable<Contact | null> {
    // 9. --- NEW: Set initial state ---
    this.startInEditMode.set(false);
    return from(this.contactsService.getContact(id)).pipe(
      map((contact) => contact ?? null)
    );
  }

  private getNewContact(): Observable<Contact> {
    // 10. --- NEW: Set initial state ---
    this.startInEditMode.set(true);
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