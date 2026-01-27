import {
  Component,
  input,
  output,
  effect,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { computedError } from '@nx-platform-application/platform-ui-forms';
import { GroupNameSchema } from '../schemas/contact-group.schema';

// MATERIAL
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// SHARED
import { ContactMultiSelectorComponent } from '../contact-multi-selector/contact-multi-selector.component';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

@Component({
  selector: 'contacts-group-form',
  standalone: true,
  imports: [
    CommonModule,
    ContactMultiSelectorComponent,
    ContactAvatarComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './contact-group-form.component.html',
  styleUrl: './contact-group-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactGroupFormComponent {
  // --- INPUTS ---
  group = input<ContactGroup | undefined>(undefined);
  allContacts = input.required<Contact[]>();
  isEditing = input<boolean>(false);
  isNew = input<boolean>(false);
  linkedChildrenCount = input<number>(0);

  // --- OUTPUTS ---
  save = output<ContactGroup>();
  delete = output<{ recursive: boolean }>();
  errorsChange = output<number>();

  // --- FORM STATE ---
  name = signal('');
  nameTouched = signal(false);
  description = signal('');

  // Members State
  contactIds = signal<string[]>([]);
  deleteRecursive = signal(false);

  // --- VALIDATION ---
  nameError = computedError(GroupNameSchema, this.name);

  isValid = computed(() => !this.nameError());
  errorCount = computed(() => (this.nameError() ? 1 : 0));

  // --- DIRTY CHECKING ---

  nameModified = computed(() => {
    if (this.isNew()) return false;
    const original = this.group()?.name || '';
    return this.name() !== original;
  });

  descriptionModified = computed(() => {
    if (this.isNew()) return false;
    const original = this.group()?.description || '';
    return this.description() !== original;
  });

  groupMembers = computed(() => {
    const ids = this.contactIds();
    const contacts = this.allContacts();
    return contacts.filter((c) => ids.includes(c.id.toString()));
  });

  constructor() {
    // 1. Hydrate Form
    effect(
      () => {
        const g = this.group();
        if (g) {
          this.name.set(g.name);
          this.description.set(g.description || '');
          // [UPDATED] Use memberUrns (V9)
          this.contactIds.set(g.memberUrns.map((urn) => urn.toString()));
        }
      },
      { allowSignalWrites: true },
    );

    // 2. Report Errors
    effect(() => {
      this.errorsChange.emit(this.errorCount());
    });
  }

  // --- VISUAL FEEDBACK (Traffic Lights) ---

  getStatusIcon(field: 'name' | 'description'): string {
    if (field === 'name') {
      if (this.nameError() && this.nameTouched()) return 'error';
      if (!this.name() && !this.nameTouched()) return 'priority_high';
    }

    if (field === 'name' && this.nameModified()) return 'edit_note';
    if (field === 'description' && this.descriptionModified())
      return 'edit_note';

    if (field === 'name' && this.name()) return 'check_circle';
    if (field === 'description' && this.description()) return 'check_circle';

    return '';
  }

  getStatusColor(field: 'name' | 'description'): string {
    const icon = this.getStatusIcon(field);
    switch (icon) {
      case 'error':
        return 'text-red-600';
      case 'edit_note':
        return 'text-blue-600 font-bold';
      case 'priority_high':
        return 'text-amber-500';
      case 'check_circle':
        return 'text-green-600';
      default:
        return '';
    }
  }

  getStatusTooltip(field: 'name' | 'description'): string {
    if (field === 'name') {
      if (this.nameError() && this.nameTouched()) return this.nameError()!;
      if (!this.name() && !this.nameTouched()) return 'Required';
      if (this.nameModified()) return 'Modified';
      if (this.name()) return 'Valid';
    }
    if (field === 'description') {
      if (this.descriptionModified()) return 'Modified';
    }
    return '';
  }

  // --- ACTIONS ---

  triggerSave(): void {
    this.nameTouched.set(true);

    if (!this.isValid()) {
      document.getElementById('group-name-input')?.focus();
      return;
    }

    const baseGroup = this.group() || {
      id: URN.create('group', crypto.randomUUID(), 'contacts'),
      // directoryId: undefined, // Optional in V9
      name: '',
      description: '',
      // scope: 'local', // Removed in V7/V9
      memberUrns: [],
      lastModified: new Date().toISOString(),
    };

    // [UPDATED] Map strings back to URNs for V9
    const updatedMemberUrns = this.contactIds().map((idStr) =>
      URN.parse(idStr),
    );

    this.save.emit({
      ...baseGroup,
      name: this.name(),
      description: this.description(),
      memberUrns: updatedMemberUrns,
    } as ContactGroup);
  }

  onDelete(): void {
    this.delete.emit({ recursive: this.deleteRecursive() });
  }

  trackContactById(index: number, contact: Contact): string {
    return contact.id.toString();
  }

  getInitials(contact: Contact): string {
    return (contact.firstName?.[0] || '') + (contact.surname?.[0] || '');
  }
}
