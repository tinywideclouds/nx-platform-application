import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  input, // Import signal input
  effect, // Import effect
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

@Component({
  selector: 'lib-contact-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
  // No ChangeDetectionStrategy.OnPush needed; signals make this the default.
})
export class ContactFormComponent {
  // 1. Use the input() function to create a Signal
  contact = input<Contact | null>(null);

  @Output() save = new EventEmitter<Contact>();
  @Output() cancel = new EventEmitter<void>();

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
    // 2. Use an effect() to react to input changes
    effect(() => {
      const currentContact = this.contact(); // Read the signal's value

      if (currentContact) {
        // "Edit Mode"
        this.form.patchValue(currentContact);
        this.phoneNumbers.clear();
        currentContact.phoneNumbers.forEach((phone) => this.addPhoneNumber(phone));
        this.emailAddresses.clear();
        currentContact.emailAddresses.forEach((email) => this.addEmailAddress(email));
      } else {
        // "Add Mode" - Fix: Reset with empty strings
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
        ...this.contact(), // Read the signal for merge
        ...this.form.value,
      });
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}