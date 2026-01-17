// libs/contacts/contacts-ui/src/lib/components/contact-group-page-form/contact-group-form.component.ts

import {
  Component,
  input,
  output,
  effect,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Contact,
  ContactGroup,
  ContactGroupMember,
} from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';

// SHARED
import { ContactMultiSelectorComponent } from '../contact-multi-selector/contact-multi-selector.component';

import { FormValidators } from '@nx-platform-application/platform-ui-forms';

// MATERIAL
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// PIPES
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

@Component({
  selector: 'contacts-group-form',
  standalone: true,
  imports: [
    CommonModule,
    ContactMultiSelectorComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatIconModule,
    MatTooltipModule,
    ContactAvatarComponent,
  ],
  templateUrl: './contact-group-form.component.html',
  styleUrl: './contact-group-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactGroupFormComponent {
  // --- INPUTS ---
  group = input<ContactGroup | null>(null);
  allContacts = input<Contact[]>([]);
  startInEditMode = input(false);
  linkedChildrenCount = input(0);

  // --- OUTPUTS ---
  save = output<ContactGroup>();
  delete = output<{ recursive: boolean }>();

  // --- UI STATE ---
  isEditing = signal(false);
  deleteRecursive = signal(false);

  // --- FORM STATE ---
  name = signal('');
  nameTouched = signal(false);

  description = signal('');

  // The selector component manages the IDs, we just hold the value
  contactIds = signal<string[]>([]);

  // --- COMPUTED VALIDATION ---
  nameError = computed(() =>
    !FormValidators.required(this.name()) ? 'Group name is required' : null,
  );

  isValid = computed(() => !this.nameError());

  // ✅ NEW: Stage 1 Detection
  hasAnyContent = computed(() => {
    return (
      !!this.name().trim() ||
      !!this.description().trim() ||
      this.contactIds().length > 0
    );
  });

  saveTooltip = computed(() => {
    // Stage 1
    if (!this.hasAnyContent()) return 'Enter group details';
    // Stage 3
    if (this.isValid()) return 'Save Group';
    // Stage 2
    return 'Missing: Group Name';
  });

  // --- DERIVED VIEW HELPERS ---
  groupMembers = computed(() => {
    const ids = this.contactIds();
    const contacts = this.allContacts();
    return contacts.filter((c) => ids.includes(c.id.toString()));
  });

  constructor() {
    effect(
      () => {
        if (this.startInEditMode()) {
          this.isEditing.set(true);
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const g = this.group();
        if (g) {
          this.name.set(g.name);
          this.description.set(g.description || '');
          this.contactIds.set(g.members.map((m) => m.contactId.toString()));
        } else {
          this.resetForm();
        }
      },
      { allowSignalWrites: true },
    );
  }

  onSave(): void {
    this.nameTouched.set(true);

    if (!this.isValid()) {
      // Simple focus logic
      document.getElementById('group-name-input')?.focus();
      return;
    }

    if (this.group()) {
      const originalGroup = this.group()!;

      const updatedMembers: ContactGroupMember[] = this.contactIds().map(
        (idStr) => {
          const existing = originalGroup.members.find(
            (m) => m.contactId.toString() === idStr,
          );
          return existing || { contactId: URN.parse(idStr), status: 'added' };
        },
      );

      this.save.emit({
        ...originalGroup,
        name: this.name(),
        description: this.description(),
        members: updatedMembers,
      });
    }
  }

  onDelete(): void {
    this.delete.emit({ recursive: this.deleteRecursive() });
  }

  onCancel(): void {
    this.isEditing.set(false);
  }

  trackContactById(index: number, contact: Contact): string {
    return contact.id.toString();
  }

  getInitials(contact: Contact): string {
    const first = contact.firstName?.[0] || '';
    const last = contact.surname?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }

  private resetForm() {
    this.name.set('');
    this.description.set('');
    this.contactIds.set([]);
    this.nameTouched.set(false);
  }
}
