import { Component, inject, input, signal, computed } from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap, tap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips'; // ✅ NEW
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

@Component({
  selector: 'contacts-group-page',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
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
   */
  groupId = input<URN | undefined>(undefined);

  // --- Internal State ---

  startInEditMode = signal(false);

  // ✅ NEW: Store active network chats spawned from this group
  subGroups = signal<ContactGroup[]>([]);

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
   * ✅ Also fetches network children.
   */
  private getGroup(urn: URN): Observable<ContactGroup | null> {
    this.startInEditMode.set(false);

    return from(this.contactsService.getGroup(urn)).pipe(
      tap((group) => {
        if (group) {
          this.loadSubGroups(group.id);
        }
      }),
      map((group) => group ?? null),
    );
  }

  private getNewGroup(): Observable<ContactGroup> {
    this.startInEditMode.set(true);
    this.subGroups.set([]); // Reset children for new group

    const newGroupUrn = URN.create('group', crypto.randomUUID(), 'contacts');
    return of({
      id: newGroupUrn,
      name: '',
      scope: 'local',
      description: '',
      members: [],
      contactIds: [],
    } as ContactGroup);
  }

  private async loadSubGroups(parentId: URN): Promise<void> {
    const children = await this.contactsService.getGroupsByParent(parentId);
    this.subGroups.set(children);
  }
}
