// libs/contacts/contacts-ui/src/lib/components/contact-group-page/contact-group-page.component.ts

import { Component, inject, input, signal, computed } from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

@Component({
  selector: 'contacts-group-page',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    ContactGroupFormComponent,
    ContactsPageToolbarComponent,
  ],
  templateUrl: './contact-group-page.component.html',
  styleUrl: './contact-group-page.component.scss',
})
export class ContactGroupPageComponent {
  private router = inject(Router);
  private contactsService = inject(ContactsStorageService);

  /**
   * The Group ID to edit.
   * If null/undefined, we assume "Add Mode".
   * Can be provided via Router Component Input Binding or direct Input.
   */
  groupId = input<URN | undefined>(undefined);

  // --- Internal State ---

  startInEditMode = signal(false);

  allContacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });

  private groupStream$: Observable<ContactGroup | null> = toObservable(
    this.groupId,
  ).pipe(
    switchMap((urn) => {
      if (urn) {
        return this.getGroup(urn);
      }
      return this.getNewGroup();
    }),
  );

  groupToEdit = toSignal(this.groupStream$, {
    initialValue: null as ContactGroup | null,
  });

  // --- Actions ---

  async onSave(group: ContactGroup): Promise<void> {
    await this.contactsService.saveGroup(group);
    this.navigateBack();
  }

  onClose(): void {
    this.navigateBack();
  }

  private navigateBack(): void {
    this.router.navigate(['/contacts'], {
      queryParams: { tab: 'groups' },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * EDIT MODE: Returns a stream for an existing group.
   */
  private getGroup(urn: URN): Observable<ContactGroup | null> {
    // Reset edit mode when switching to an existing group
    this.startInEditMode.set(false);

    return from(this.contactsService.getGroup(urn)).pipe(
      map((group) => {
        if (!group) {
          // Handle Not Found: Redirect or return null
          // For now, we'll return null which keeps the loading state or could show an error
          return null;
        }
        return group;
      }),
    );
  }

  /**
   * ADD MODE: Returns a stream for a new, empty group.
   */
  private getNewGroup(): Observable<ContactGroup> {
    // Force edit mode when creating new
    this.startInEditMode.set(true);

    const newGroupUrn = URN.create('group', crypto.randomUUID(), 'contacts');
    return of({
      id: newGroupUrn,
      name: '',
      description: '',
      contactIds: [],
    });
  }
}
