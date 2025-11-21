// libs/contacts/contacts-ui/src/lib/components/contact-group-page/contact-group-page.component.ts

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-access';
// --- 1. Import URN ---
import { URN } from '@nx-platform-application/platform-types';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

@Component({
  selector: 'contacts-group-page',
  standalone: true,
  imports: [
    CommonModule,
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private contactsService = inject(ContactsStorageService); // No 'as' needed

  startInEditMode = signal(false);

  allContacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });

  private id$: Observable<string | null> = this.route.paramMap.pipe(
    map((params) => params.get('id')) // This is always a string
  );

  private groupStream$: Observable<ContactGroup | null> = this.id$.pipe(
    switchMap((id) => {
      // id is a string from the URL, or null
      return id ? this.getGroup(id) : this.getNewGroup();
    })
  );

  groupToEdit = toSignal(this.groupStream$, {
    initialValue: null as ContactGroup | null,
  });

  async onSave(group: ContactGroup): Promise<void> {
    await this.contactsService.saveGroup(group);
    this.router.navigate(['/contacts'], { queryParams: { tab: 'groups' } });
  }

  onCancel(): void {
    this.router.navigate(['/contacts'], { queryParams: { tab: 'groups' } });
  }

  /**
   * EDIT MODE: Returns a stream for an existing group.
   * @param id The string ID from the URL.
   */
  private getGroup(id: string): Observable<ContactGroup | null> {
    this.startInEditMode.set(false);
    // --- 2. Parse the string ID into a URN ---
    try {
      const groupUrn = URN.parse(id);
      return from(this.contactsService.getGroup(groupUrn)).pipe(
        map((group) => group ?? null) // Ensure undefined becomes null
      );
    } catch (error) {
      console.error('Invalid Group URN in URL:', id, error);
      // TODO: Handle error, e.g., navigate to not-found
      return of(null);
    }
  }

  /**
   * ADD MODE: Returns a stream for a new, empty group.
   */
  private getNewGroup(): Observable<ContactGroup> {
    this.startInEditMode.set(true);
    // --- 3. Create a valid URN for the new group ---
    const newGroupUrn = URN.create('group', crypto.randomUUID());
    return of({
      id: newGroupUrn, // <-- Use the URN object
      name: '',
      description: '',
      contactIds: [],
    });
  }
}
