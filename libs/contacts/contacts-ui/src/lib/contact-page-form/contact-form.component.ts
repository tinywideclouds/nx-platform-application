// libs/contacts/contacts-ui/src/lib/components/contact-page-form/contact-form.component.ts

import {
  Component,
  Output,
  EventEmitter,
  inject,
  input,
  effect,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { Contact } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

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
    MatChipsModule,
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
})
export class ContactFormComponent {
  contact = input<Contact | null>(null);
  // --- NEW INPUT ---
  linkedIdentities = input<URN[]>([]);
  startInEditMode = input(false);

  @Output() save = new EventEmitter<Contact>();

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
    effect(() => {
      this.isEditing.set(this.startInEditMode());
    });

    effect(() => {
      const currentContact = this.contact();

      if (currentContact) {
        this.form.patchValue(currentContact);
        this.phoneNumbers.clear();
        currentContact.phoneNumbers.forEach((phone) =>
          this.addPhoneNumber(phone),
        );
        this.emailAddresses.clear();
        currentContact.emailAddresses.forEach((email) =>
          this.addEmailAddress(email),
        );
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

    effect(() => {
      if (this.isEditing()) {
        this.form.enable();
      } else {
        this.form.disable();
        if (this.contact()) {
          this.form.reset(this.contact());
        }
      }
    });
  }

  get phoneNumbers() {
    return this.form.get('phoneNumbers') as FormArray;
  }
  get emailAddresses() {
    return this.form.get('emailAddresses') as FormArray;
  }

  addPhoneNumber(phone = ''): void {
    this.phoneNumbers.push(this.fb.control(phone, Validators.required));
  }
  removePhoneNumber(index: number): void {
    this.phoneNumbers.removeAt(index);
  }
  addEmailAddress(email = ''): void {
    this.emailAddresses.push(
      this.fb.control(email, [Validators.required, Validators.email]),
    );
  }
  removeEmailAddress(index: number): void {
    this.emailAddresses.removeAt(index);
  }

  onSave(): void {
    if (this.form.valid) {
      this.save.emit({
        ...this.contact(),
        ...this.form.value,
      });
    }
  }

  onCancel(): void {
    this.isEditing.set(false);
  }

  // --- Helper to format URNs for display ---
  getProviderName(urn: URN): string {
    // urn:auth:google:123 -> google
    const parts = urn.toString().split(':');
    return parts.length > 2 ? parts[2] : 'Unknown';
  }

  getProviderId(urn: URN): string {
    const parts = urn.toString().split(':');
    return parts.length > 3 ? parts.slice(3).join(':') : urn.toString();
  }
}
