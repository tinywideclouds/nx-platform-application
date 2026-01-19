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
import {
  Contact,
  ContactGroup,
  ContactGroupMember,
} from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { computedError } from '@nx-platform-application/platform-ui-forms';
import { GroupNameSchema } from '../schemas/contact-group.schema';

// MATERIAL
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';

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
  ],
  templateUrl: './contact-group-form.component.html',
  styleUrl: './contact-group-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactGroupFormComponent {
  // --- INPUTS ---
  group = input<ContactGroup | null>(null);
  allContacts = input<Contact[]>([]);
  isEditing = input(false); // [NEW] Controlled by parent
  linkedChildrenCount = input(0);

  // --- OUTPUTS ---
  save = output<ContactGroup>();
  delete = output<{ recursive: boolean }>();
  errorsChange = output<number>(); // [NEW] Report errors to parent

  // --- FORM STATE ---
  name = signal('');
  nameTouched = signal(false);
  description = signal('');
  contactIds = signal<string[]>([]);
  deleteRecursive = signal(false);

  // --- VALIDATION ---
  nameError = computedError(GroupNameSchema, this.name);

  isValid = computed(() => !this.nameError());

  errorCount = computed(() => (this.isValid() ? 0 : 1));

  groupMembers = computed(() => {
    const ids = this.contactIds();
    const contacts = this.allContacts();
    return contacts.filter((c) => ids.includes(c.id.toString()));
  });

  constructor() {
    // Reset form when group changes
    effect(() => {
      const g = this.group();
      if (g) {
        this.name.set(g.name);
        this.description.set(g.description || '');
        this.contactIds.set(g.members.map((m) => m.contactId.toString()));
      } else {
        this.resetForm();
      }
    });

    // Report validation status
    effect(() => {
      this.errorsChange.emit(this.errorCount());
    });
  }

  // [NEW] Triggered by Parent Toolbar
  triggerSave(): void {
    this.nameTouched.set(true);

    if (!this.isValid()) {
      document.getElementById('group-name-input')?.focus();
      return;
    }

    if (this.group()) {
      const originalGroup = this.group()!;

      // Merge new members while preserving existing member metadata
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
