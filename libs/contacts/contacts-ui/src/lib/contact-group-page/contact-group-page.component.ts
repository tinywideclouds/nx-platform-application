import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap, tap } from 'rxjs/operators';
import { from, of, combineLatest, Observable } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
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
  private route = inject(ActivatedRoute);
  private state = inject(ContactsStateService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  // --- STRICT CONTRACT ---
  saved = output<ContactGroup>();
  deleted = output<void>();
  cancelled = output<void>();

  groupId = input<URN | undefined>(undefined);

  // Internal State
  subGroups = signal<ContactGroup[]>([]);
  linkedChildrenCount = computed(() => this.subGroups().length);

  allContacts = toSignal(this.state.contacts$, {
    initialValue: [] as Contact[],
  });

  // --- ID RESOLUTION ---
  private routeId$ = this.route.paramMap.pipe(map((p) => p.get('id')));
  private inputId$ = toObservable(this.groupId);

  resolvedId = toSignal(
    combineLatest([this.routeId$, this.inputId$]).pipe(
      map(([routeId, inputId]) => {
        // 1. Input Priority (Viewer)
        if (inputId) return { urn: inputId, isNew: false };
        // 2. Route Fallback
        if (routeId) {
          try {
            return { urn: URN.parse(routeId), isNew: false };
          } catch {
            return null;
          }
        }
        // 3. Creation Mode
        return {
          urn: URN.create('group', crypto.randomUUID(), 'contacts'),
          isNew: true,
        };
      }),
    ),
    { initialValue: null },
  );

  // --- COMPUTED UI STATE ---
  // ✅ FIXED: Restored as computed property so template works
  startInEditMode = computed(() => this.resolvedId()?.isNew ?? false);

  // --- DATA FETCHING ---
  private groupStream$ = toObservable(this.resolvedId).pipe(
    switchMap((data) => {
      if (!data) return of(null);
      // Reactively choose fetch method based on ID state
      if (data.isNew) return this.getNewGroup(data.urn);
      return this.getGroup(data.urn);
    }),
  );

  groupToEdit = toSignal(this.groupStream$, { initialValue: null });

  async onSave(group: ContactGroup): Promise<void> {
    await this.state.saveGroup(group);

    const isNew = this.startInEditMode();
    const action = isNew ? 'created' : 'updated';

    this.snackBar.open(`Group '${group.name}' ${action}`, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });

    this.saved.emit(group);
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
          this.state.deleteGroup(child.id),
        );
        await Promise.all(promises);
      }

      await this.state.deleteGroup(group.id);
      this.deleted.emit();
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  private getGroup(urn: URN): Observable<ContactGroup | null> {
    return from(this.state.getGroup(urn)).pipe(
      tap((group) => {
        if (group) {
          this.loadSubGroups(group.id);
        }
      }),
      map((group) => group ?? null),
    );
  }

  private getNewGroup(urn: URN): Observable<ContactGroup> {
    this.subGroups.set([]);
    return of({
      id: urn,
      name: '',
      scope: 'local',
      description: '',
      members: [],
      contactIds: [],
    } as ContactGroup);
  }

  private async loadSubGroups(parentId: URN): Promise<void> {
    const children = await this.state.getGroupsByParent(parentId);
    this.subGroups.set(children);
  }
}
