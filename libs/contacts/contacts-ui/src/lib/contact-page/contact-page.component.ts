import {
  Component,
  inject,
  input,
  output,
  computed,
  signal,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { combineLatest, from, of } from 'rxjs';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state';

// UI
import { ContactFormComponent } from '../contact-page-form/contact-form.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import {
  ConfirmationDialogComponent,
  ConfirmationData,
} from '@nx-platform-application/platform-ui-toolkit';
import { boolean } from 'valibot';

@Component({
  selector: 'contacts-page',
  standalone: true,
  imports: [
    ContactFormComponent,
    ContactsPageToolbarComponent,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
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

  @ViewChild(ContactFormComponent) formComponent!: ContactFormComponent;

  selectedUrn = input<URN | undefined>(undefined);

  // OUTPUTS
  saved = output<Contact>();
  deleted = output<void>();
  cancelled = output<void>();
  editRequested = output<Contact>();

  // Tracks the number of active errors for button labeling
  formErrorCount = signal(0);

  private routeId$ = this.route.paramMap.pipe(map((p) => p.get('id')));
  private modeParam$ = this.route.queryParamMap.pipe(map((p) => p.get('mode')));
  private inputId$ = toObservable(this.selectedUrn);

  contactContext = toSignal(
    combineLatest([this.routeId$, this.inputId$, this.modeParam$]).pipe(
      map(([routeId, inputId, mode]) => {
        const isEditMode = mode === 'edit';
        if (inputId) return { urn: inputId, isNew: false, isEditMode };
        if (routeId) {
          try {
            return { urn: URN.parse(routeId), isNew: false, isEditMode };
          } catch {
            return null;
          }
        }
        return {
          urn: URN.create('user', crypto.randomUUID(), 'contacts'),
          isNew: true,
          isEditMode: true,
        };
      }),
    ),
    { initialValue: null },
  );

  isMobile = input(false);
  isEditMode = computed(() => this.contactContext()?.isEditMode ?? false);
  isNew = computed(() => this.contactContext()?.isNew ?? false);

  private contactStream$ = toObservable(this.contactContext).pipe(
    switchMap((ctx) => {
      if (!ctx) return of(null);
      if (ctx.isNew) return of(this.createEmptyContact(ctx.urn));
      return from(this.state.getContact(ctx.urn)).pipe(
        map((c) => c ?? this.createEmptyContact(ctx.urn)),
      );
    }),
  );
  contact = toSignal(this.contactStream$, { initialValue: null });

  private linkedIdentitiesStream$ = toObservable(this.contactContext).pipe(
    switchMap((ctx) =>
      ctx && !ctx.isNew
        ? from(this.state.getLinkedIdentities(ctx.urn))
        : of([]),
    ),
  );
  linkedIdentities = toSignal(this.linkedIdentitiesStream$, {
    initialValue: [],
  });

  private groupsStream$ = toObservable(this.contactContext).pipe(
    switchMap((ctx) =>
      ctx && !ctx.isNew
        ? from(this.state.getGroupsForContact(ctx.urn))
        : of([]),
    ),
  );
  groups = toSignal(this.groupsStream$, { initialValue: [] });

  enableEditMode(): void {
    const contact = this.contact();
    if (contact) {
      this.editRequested.emit(contact);
    }
  }

  triggerFormSave(): void {
    if (this.formComponent) {
      this.formComponent.triggerSave();
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  async onSave(contact: Contact): Promise<void> {
    await this.state.saveContact(contact);

    // UI Feedback
    const action = this.isNew() ? 'created' : 'updated';
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
