import { Component, inject, input, output } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { from, Observable } from 'rxjs';

import { ContactsStateService } from '@nx-platform-application/contacts-state'; // ✅ State
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

import { ContactFormComponent } from '../contact-page-form/contact-form.component';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import {
  ConfirmationDialogComponent,
  ConfirmationData,
} from '@nx-platform-application/platform-ui-toolkit';

@Component({
  selector: 'contacts-detail',
  standalone: true,
  imports: [ContactFormComponent, MatChipsModule],
  templateUrl: './contact-detail.component.html',
  styleUrl: './contact-detail.component.scss',
})
export class ContactDetailComponent {
  private state = inject(ContactsStateService); // ✅ State
  private dialog = inject(MatDialog);

  contactId = input.required<URN>();
  startInEditMode = input(false);
  readonly = input(false);

  saved = output<Contact>();
  deleted = output<void>();

  private contactStream$: Observable<Contact | null> = toObservable(
    this.contactId,
  ).pipe(
    switchMap((id) => {
      return from(this.state.getContact(id)).pipe(
        map((existing) => existing ?? this.createEmptyContact(id)),
      );
    }),
  );

  contactToEdit = toSignal(this.contactStream$, { initialValue: null });

  private linkedIdentitiesStream$: Observable<URN[]> = toObservable(
    this.contactId,
  ).pipe(
    switchMap((id) => from(this.state.getLinkedIdentities(id))), // ✅ Delegated
  );

  linkedIdentities = toSignal(this.linkedIdentitiesStream$, {
    initialValue: [],
  });

  private groupsForContactStream$: Observable<ContactGroup[]> = toObservable(
    this.contactId,
  ).pipe(
    switchMap((id) => from(this.state.getGroupsForContact(id))), // ✅ Delegated
  );

  groupsForContact = toSignal(this.groupsForContactStream$, {
    initialValue: [],
  });

  async onSave(contact: Contact): Promise<void> {
    await this.state.saveContact(contact);
    this.saved.emit(contact);
  }

  async onDelete(): Promise<void> {
    const contact = this.contactToEdit();
    if (!contact) return;

    const ref = this.dialog.open<
      ConfirmationDialogComponent,
      ConfirmationData,
      boolean
    >(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Contact?',
        message: `Are you sure you want to delete <strong>${contact.alias}</strong>?`,
        confirmText: 'Delete',
        confirmColor: 'warn',
        icon: 'delete',
      },
    });

    const result = await ref.afterClosed().toPromise();

    if (result) {
      await this.state.deleteContact(contact.id);
      this.deleted.emit();
    }
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
