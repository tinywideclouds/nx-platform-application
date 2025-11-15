// libs/contacts/contacts-ui/src/lib/components/contact-page/contact-page.component.ts

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private contactsService = inject(
    ContactsStorageService
  ) as ContactsStorageService;

  startInEditMode = signal(false);

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

  private getContact(id: string): Observable<Contact | null> {
    this.startInEditMode.set(false);
    return from(this.contactsService.getContact(id)).pipe(
      map((contact) => contact ?? null)
    );
  }

  private getNewContact(): Observable<Contact> {
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