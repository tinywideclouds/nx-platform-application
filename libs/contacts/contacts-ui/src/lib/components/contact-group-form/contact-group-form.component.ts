// libs/contacts/contacts-ui/src/lib/components/contact-group-form/contact-group-form.component.ts

import {
  Component,
  input,
  output,
  effect,
  inject,
  signal, // 1. Import signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
  startInEditMode = input(false); // 2. NEW: Input for initial state

  /** Emits the saved group data. */
  save = output<ContactGroup>();

  // 3. --- @Output() cancel is removed ---

  // --- Internal State ---

  private fb = inject(FormBuilder);

  // 4. --- NEW: Internal state for edit mode ---
  isEditing = signal(false);

  form: FormGroup = this.fb.group({
    id: [''],
    name: ['', Validators.required],
    description: [''],
    contactIds: [[] as string[]],
  });

  constructor() {
    // 5. --- NEW: Disable form by default ---
    this.form.disable();

    // 6. --- NEW: Effect to set initial state ---
    effect(() => {
      this.isEditing.set(this.startInEditMode());
    });

    // 7. Effect to patch data when the 'group' input changes
    effect(() => {
      const currentGroup = this.group();

      if (currentGroup) {
        // "Edit Mode": Patch the form with group data
        this.form.patchValue(currentGroup);
      } else {
        // "Add Mode": Reset the form to its empty state
        this.form.reset({
          id: '',
          name: '',
          description: '',
          contactIds: [],
        });
      }
    });

    // 8. --- NEW: Effect to toggle form state ---
    effect(() => {
      if (this.isEditing()) {
        this.form.enable();
      } else {
        this.form.disable();
        // Reset form to its original state when leaving edit mode
        if (this.group()) {
          this.form.reset(this.group());
        }
      }
    });
  }

  // --- Event Handlers ---

  onSave(): void {
    if (this.form.valid) {
      this.save.emit({
        ...this.group(), // Preserves any non-form data from the original
        ...this.form.value,
      });
    }
  }

  // 9. --- REFACTORED: onCancel now just sets state ---
  onCancel(): void {
    this.isEditing.set(false);
  }
}