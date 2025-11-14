// libs/contacts/contacts-ui/src/lib/components/contact-group-form/contact-group-form.component.ts

import {
  Component,
  input,
  output,
  effect,
  inject,
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
  selector: 'lib-contact-group-form',
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

  /** Emits the saved group data. */
  save = output<ContactGroup>();

  /** Emits when the user cancels. */
  cancel = output<void>();

  // --- Internal State ---

  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    id: [''],
    name: ['', Validators.required],
    description: [''],
    contactIds: [[] as string[]], // This will be bound to the multi-selector
  });

  constructor() {
    // React to changes in the 'group' input signal
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

  onCancel(): void {
    this.cancel.emit();
  }
}