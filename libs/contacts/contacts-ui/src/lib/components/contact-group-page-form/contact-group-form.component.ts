// libs/contacts/contacts-ui/src/lib/components/contact-group-form/contact-group-form.component.ts

import {
  Component,
  input,
  output,
  effect,
  inject,
  signal,
  computed, // 1. Import computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop'; // 2. Import toSignal
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { ContactMultiSelectorComponent } from '../contact-multi-selector/contact-multi-selector.component';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component'; // 3. Import avatar

@Component({
  selector: 'contacts-group-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ContactMultiSelectorComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ContactAvatarComponent, // 4. Add avatar to imports
  ],
  templateUrl: './contact-group-form.component.html',
  styleUrl: './contact-group-form.component.scss',
})
export class ContactGroupFormComponent {
  // --- API ---

  /** The group to edit, or null for a new group. */
  group = input<ContactGroup | null>(null);

  /** The full list of contacts to show in the multi-selector. */
  allContacts = input.required<Contact[]>();

  /** The initial state of the form. */
  startInEditMode = input(false);

  /** Emits the saved group data. */
  save = output<ContactGroup>();

  // --- Internal State ---

  private fb = inject(FormBuilder);

  isEditing = signal(false);

  form: FormGroup = this.fb.group({
    id: [''],
    name: ['', Validators.required],
    description: [''],
    contactIds: [[] as string[]],
  });

  // 5. --- NEW: Signal that tracks the form's contactIds value ---
  private contactIdsValue = toSignal(
    this.form.get('contactIds')!.valueChanges,
    { initialValue: this.form.get('contactIds')!.value }
  );

  constructor() {
    this.form.disable();

    effect(() => {
      this.isEditing.set(this.startInEditMode());
    });

    effect(() => {
      const currentGroup = this.group();
      if (currentGroup) {
        this.form.patchValue(currentGroup);
      } else {
        this.form.reset({
          id: '',
          name: '',
          description: '',
          contactIds: [],
        });
      }
    });

    effect(() => {
      if (this.isEditing()) {
        this.form.enable();
      } else {
        this.form.disable();
        if (this.group()) {
          this.form.reset(this.group());
        }
      }
    });
  }

  // 6. --- NEW: Computed signal to get full Contact objects for members ---
  groupMembers = computed(() => {
    // Create a map for fast O(1) lookups
    const membersMap = new Map(this.allContacts().map((c) => [c.id, c]));
    // Get the current list of IDs from the form's signal
    const contactIds = this.contactIdsValue() ?? [];

    return contactIds
      .map((id: string) => membersMap.get(id)) // Find the full contact object
      .filter((c: Contact ): c is Contact => Boolean(c)); // Filter out any undefined/missing
  });

  // --- Event Handlers ---

  onSave(): void {
    if (this.form.valid) {
      this.save.emit({
        ...this.group(),
        ...this.form.value,
      });
    }
  }

  onCancel(): void {
    this.isEditing.set(false);
  }

  // 7. --- NEW: Helper methods for rendering avatars ---
  getInitials(contact: Contact): string {
    const first = contact.firstName?.[0] || '';
    const last = contact.surname?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }

  getProfilePicture(contact: Contact): string | undefined {
    return contact.serviceContacts['messenger']?.profilePictureUrl;
  }
}