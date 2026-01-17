import { Component, inject, input, output, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { combineLatest, from, of } from 'rxjs';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state';

// UI
import { ContactFormComponent } from '../contact-page-form/contact-form.component'; // ✅ Direct Form usage
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips'; // ✅ For Groups List
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import {
  ConfirmationDialogComponent,
  ConfirmationData,
} from '@nx-platform-application/platform-ui-toolkit';

@Component({
  selector: 'contacts-page',
  standalone: true,
  imports: [
    ContactFormComponent,
    ContactsPageToolbarComponent,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.scss',
})
export class ContactPageComponent {
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private state = inject(ContactsStateService);

  // --- INPUTS ---
  selectedUrn = input<URN | undefined>(undefined);

  // --- OUTPUTS ---
  saved = output<Contact>();
  deleted = output<void>();
  cancelled = output<void>();

  // --- ID RESOLUTION ---
  private routeId$ = this.route.paramMap.pipe(map((p) => p.get('id')));
  private inputId$ = toObservable(this.selectedUrn);

  contactId = toSignal(
    combineLatest([this.routeId$, this.inputId$]).pipe(
      map(([routeId, inputId]) => {
        if (inputId) return { urn: inputId, isNew: false };
        if (routeId) {
          try {
            return { urn: URN.parse(routeId), isNew: false };
          } catch {
            return null;
          }
        }
        return {
          urn: URN.create('user', crypto.randomUUID(), 'contacts'),
          isNew: true,
        };
      }),
    ),
    { initialValue: null },
  );

  // --- DATA FETCHING (Moved from Detail) ---

  // 1. Contact Object
  private contactStream$ = toObservable(this.contactId).pipe(
    switchMap((data) => {
      if (!data) return of(null);
      if (data.isNew) return of(this.createEmptyContact(data.urn));

      return from(this.state.getContact(data.urn)).pipe(
        map((c) => c ?? this.createEmptyContact(data.urn)),
      );
    }),
  );
  contact = toSignal(this.contactStream$, { initialValue: null });

  // 2. Linked Identities
  private linkedIdentitiesStream$ = toObservable(this.contactId).pipe(
    switchMap((data) =>
      data && !data.isNew
        ? from(this.state.getLinkedIdentities(data.urn))
        : of([]),
    ),
  );
  linkedIdentities = toSignal(this.linkedIdentitiesStream$, {
    initialValue: [],
  });

  // 3. Group Memberships
  private groupsStream$ = toObservable(this.contactId).pipe(
    switchMap((data) =>
      data && !data.isNew
        ? from(this.state.getGroupsForContact(data.urn))
        : of([]),
    ),
  );
  groups = toSignal(this.groupsStream$, { initialValue: [] });

  // --- ACTIONS ---

  async onSave(contact: Contact): Promise<void> {
    await this.state.saveContact(contact);

    const isNew = this.contactId()?.isNew ?? false;
    const action = isNew ? 'created' : 'updated';

    this.snackBar.open(`Contact '${contact.alias}' ${action}`, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });

    this.saved.emit(contact);
  }

  async onDelete(): Promise<void> {
    const contact = this.contact();
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

  onCancel(): void {
    this.cancelled.emit();
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
