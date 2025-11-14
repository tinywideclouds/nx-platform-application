// libs/contacts/contacts-ui/src/lib/components/contact-form/contact-form.component.ts

import {
  Component,
  Output,
  EventEmitter,
  inject,
  input,
  effect,
  signal, // 1. Import signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { Contact } from '@nx-platform-application/contacts-data-access';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'contacts-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
})
export class ContactFormComponent {
  contact = input<Contact | null>(null);
  // 2. --- NEW: Input for initial state ---
  startInEditMode = input(false);

  @Output() save = new EventEmitter<Contact>();
  // 3. --- @Output() cancel is removed ---

  // 4. --- NEW: Internal state for edit mode ---
  isEditing = signal(false);

  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    id: [''],
    firstName: ['', Validators.required],
    surname: ['', Validators.required],
    alias: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phoneNumbers: this.fb.array([]),
    emailAddresses: this.fb.array([]),
    isFavorite: [false],
  });

  constructor() {
    // 5. --- NEW: Set internal state from input ---
    effect(() => {
      this.isEditing.set(this.startInEditMode());
    });

    // This effect patches data when the contact input changes
    effect(() => {
      const currentContact = this.contact();

      if (currentContact) {
        this.form.patchValue(currentContact);
        this.phoneNumbers.clear();
        currentContact.phoneNumbers.forEach((phone) => this.addPhoneNumber(phone));
        this.emailAddresses.clear();
        currentContact.emailAddresses.forEach((email) => this.addEmailAddress(email));
      } else {
        this.form.reset({
          id: '',
          firstName: '',
          surname: '',
          alias: '',
          email: '',
          isFavorite: false,
        });
        this.phoneNumbers.clear();
        this.emailAddresses.clear();
      }
    });

    // 6. --- This effect now uses the INTERNAL isEditing signal ---
    effect(() => {
      if (this.isEditing()) {
        this.form.enable();
      } else {
        this.form.disable();
        // Reset form to its original state when leaving edit mode
        if (this.contact()) {
          this.form.reset(this.contact());
        }
      }
    });
  }

  // --- FormArray Getters ---
  get phoneNumbers() {
    return this.form.get('phoneNumbers') as FormArray;
  }
  get emailAddresses() {
    return this.form.get('emailAddresses') as FormArray;
  }

  // --- FormArray Mutators ---
  addPhoneNumber(phone = ''): void {
    this.phoneNumbers.push(this.fb.control(phone, Validators.required));
  }
  removePhoneNumber(index: number): void {
    this.phoneNumbers.removeAt(index);
  }
  addEmailAddress(email = ''): void {
    this.emailAddresses.push(
      this.fb.control(email, [Validators.required, Validators.email])
    );
  }
  removeEmailAddress(index: number): void {
    this.emailAddresses.removeAt(index);
  }

  // --- Event Handlers ---
  onSave(): void {
    if (this.form.valid) {
      this.save.emit({
        ...this.contact(),
        ...this.form.value,
      });
    }
  }

  // 7. --- REFACTORED: onCancel now just sets state ---
  onCancel(): void {
    this.isEditing.set(false);
  }
}