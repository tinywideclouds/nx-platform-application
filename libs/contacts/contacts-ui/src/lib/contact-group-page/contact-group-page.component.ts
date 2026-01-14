// libs/contacts/contacts-ui/src/lib/components/contact-group-page/contact-group-page.component.ts
import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap, tap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

import {
  ConfirmationDialogComponent,
  ConfirmationData,
} from '@nx-platform-application/platform-ui-toolkit';

@Component({
  selector: 'contacts-group-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDialogModule,
    ContactGroupFormComponent,
    ContactsPageToolbarComponent,
  ],
  templateUrl: './contact-group-page.component.html',
  styleUrl: './contact-group-page.component.scss',
})
export class ContactGroupPageComponent {
  private contactsService = inject(ContactsStorageService);
  private dialog = inject(MatDialog);

  // ✅ 1. Outputs replace Router
  saved = output<void>();
  cancelled = output<void>();

  groupId = input<URN | undefined>(undefined);
  startInEditMode = signal(false);
  subGroups = signal<ContactGroup[]>([]);

  linkedChildrenCount = computed(() => this.subGroups().length);

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

  async onSave(group: ContactGroup): Promise<void> {
    await this.contactsService.saveGroup(group);
    // ✅ Emit event instead of navigating
    this.saved.emit();
  }

  async onDelete(options: { recursive: boolean }): Promise<void> {
    const group = this.groupToEdit();
    if (!group) return;

    const ref = this.dialog.open<
      ConfirmationDialogComponent,
      ConfirmationData,
      boolean
    >(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Group?',
        message: `Are you sure you want to delete <strong>${group.name}</strong>?`,
        confirmText: 'Delete',
        confirmColor: 'warn',
        icon: 'delete',
      },
    });

    const result = await ref.afterClosed().toPromise();

    if (result) {
      if (options.recursive && this.subGroups().length > 0) {
        const promises = this.subGroups().map((child) =>
          this.contactsService.deleteGroup(child.id),
        );
        await Promise.all(promises);
      }

      await this.contactsService.deleteGroup(group.id);
      // ✅ Emit event instead of navigating
      this.saved.emit();
    }
  }

  onClose(): void {
    // ✅ Emit event instead of navigating
    this.cancelled.emit();
  }

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
    this.subGroups.set([]);
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
