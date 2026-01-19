import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  ViewChild,
  effect,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap, tap } from 'rxjs/operators';
import { from, of, combineLatest, Observable } from 'rxjs';

// UI
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
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
    MatTooltipModule,
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

  @ViewChild(ContactGroupFormComponent)
  formComponent!: ContactGroupFormComponent;

  // --- INPUTS ---
  groupId = input<URN | undefined>(undefined);
  // [NEW] Layout Awareness
  isMobile = input(false);

  // --- OUTPUTS ---
  saved = output<ContactGroup>();
  deleted = output<void>();
  cancelled = output<void>();

  // --- UI STATE ---
  // [NEW] Lifted from the form
  isEditing = signal(false);
  formErrorCount = signal(0);
  subGroups = signal<ContactGroup[]>([]);
  linkedChildrenCount = computed(() => this.subGroups().length);

  allContacts = toSignal(this.state.contacts$, { initialValue: [] });

  // --- ID RESOLUTION ---
  private routeId$ = this.route.paramMap.pipe(map((p) => p.get('id')));
  private inputId$ = toObservable(this.groupId);

  resolvedId = toSignal(
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
          urn: URN.create('group', crypto.randomUUID(), 'contacts'),
          isNew: true,
        };
      }),
    ),
    { initialValue: null },
  );

  private groupStream$ = toObservable(this.resolvedId).pipe(
    switchMap((data) => {
      if (!data) return of(null);

      // Auto-enable edit mode for new groups
      if (data.isNew) {
        this.isEditing.set(true);
        return this.getNewGroup(data.urn);
      } else {
        this.isEditing.set(false);
        return this.getGroup(data.urn);
      }
    }),
  );

  groupToEdit = toSignal(this.groupStream$, { initialValue: null });

  // --- ACTIONS ---

  enableEditMode(): void {
    this.isEditing.set(true);
  }

  triggerFormSave(): void {
    if (this.formComponent) {
      this.formComponent.triggerSave();
    }
  }

  onCancel(): void {
    if (this.isEditing() && !this.resolvedId()?.isNew) {
      this.isEditing.set(false);
    } else {
      this.cancelled.emit();
    }
  }

  async onSave(group: ContactGroup): Promise<void> {
    await this.state.saveGroup(group);

    const isNew = this.resolvedId()?.isNew;
    const action = isNew ? 'created' : 'updated';

    this.snackBar.open(`Group '${group.name}' ${action}`, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });

    this.isEditing.set(false);
    this.saved.emit(group);
  }

  async onDelete(
    options: { recursive: boolean } = { recursive: false },
  ): Promise<void> {
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

    if (await ref.afterClosed().toPromise()) {
      if (options.recursive && this.subGroups().length > 0) {
        await Promise.all(
          this.subGroups().map((child) => this.state.deleteGroup(child.id)),
        );
      }
      await this.state.deleteGroup(group.id);
      this.deleted.emit();
    }
  }

  // --- DATA FETCHING ---
  private getGroup(urn: URN): Observable<ContactGroup | null> {
    return from(this.state.getGroup(urn)).pipe(
      tap((group) => {
        if (group) this.loadSubGroups(group.id);
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
