// libs/contacts/contacts-ui/src/lib/components/contact-detail/contact-detail.component.ts

import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';

import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-storage';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

import { ContactFormComponent } from '../contact-page-form/contact-form.component';
// Toolbar Removed
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'contacts-detail',
  standalone: true,
  imports: [CommonModule, ContactFormComponent, MatChipsModule],
  templateUrl: './contact-detail.component.html',
  styleUrl: './contact-detail.component.scss',
})
export class ContactDetailComponent {
  private contactsService = inject(ContactsStorageService);

  // --- Inputs ---
  contactId = input.required<URN>();
  startInEditMode = input(false);

  // --- Outputs ---
  saved = output<Contact>();
  // 'close' output REMOVED (Parent handles navigation context)

  // --- Internal State ---

  private contactStream$: Observable<Contact | null> = toObservable(
    this.contactId
  ).pipe(
    switchMap((id) => {
      return from(this.contactsService.getContact(id)).pipe(
        map((existing) => existing ?? this.createEmptyContact(id))
      );
    })
  );

  contactToEdit = toSignal(this.contactStream$, { initialValue: null });

  private linkedIdentitiesStream$: Observable<URN[]> = toObservable(
    this.contactId
  ).pipe(switchMap((id) => from(this.contactsService.getLinkedIdentities(id))));

  linkedIdentities = toSignal(this.linkedIdentitiesStream$, {
    initialValue: [],
  });

  private groupsForContactStream$: Observable<ContactGroup[]> = toObservable(
    this.contactId
  ).pipe(switchMap((id) => from(this.contactsService.getGroupsForContact(id))));

  groupsForContact = toSignal(this.groupsForContactStream$, {
    initialValue: [],
  });

  // --- Actions ---

  async onSave(contact: Contact): Promise<void> {
    await this.contactsService.saveContact(contact);
    this.saved.emit(contact);
  }

  private createEmptyContact(id: URN): Contact {
    return {
      id,
      alias: '',
      email: '',
      firstName: '',
      surname: '',
      lastModified: '' as ISODateTimeString,
      phoneNumbers: [],
      emailAddresses: [],
      serviceContacts: {},
    };
  }
}
