import {
  Component,
  output,
  input,
  effect,
  signal,
  computed,
  ChangeDetectionStrategy,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Contact } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';

// MATERIAL
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FormValidators } from '@nx-platform-application/platform-ui-forms';

@Component({
  selector: 'contacts-form',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactFormComponent {
  private el = inject(ElementRef);

  // --- INPUTS ---
  contact = input<Contact | null>(null);
  linkedIdentities = input<URN[]>([]);
  startInEditMode = input(false);
  readonly = input(false);

  // --- OUTPUTS (Strict Contract) ---
  save = output<Contact>();
  delete = output<void>();
  cancel = output<void>();

  // --- UI STATE ---
  isEditing = signal(false);

  // --- FORM STATE (Signals) ---
  firstName = signal('');
  firstNameTouched = signal(false);

  surname = signal('');
  surnameTouched = signal(false);

  alias = signal('');
  aliasTouched = signal(false);

  email = signal('');
  emailTouched = signal(false);

  emailAddresses = signal<string[]>([]);
  phoneNumbers = signal<string[]>([]);

  // --- COMPUTED VALIDATION ---
  firstNameError = computed(() =>
    !FormValidators.required(this.firstName())
      ? 'First name is required'
      : null,
  );

  aliasError = computed(() =>
    !FormValidators.required(this.alias()) ? 'Alias is required' : null,
  );

  emailError = computed(() => {
    if (!FormValidators.required(this.email())) return 'Email is required';
    if (!FormValidators.email(this.email())) return 'Invalid email address';
    return null;
  });

  hasArrayErrors = computed(() => {
    return this.emailAddresses().some((e) => !FormValidators.email(e));
  });

  isValid = computed(() => {
    return (
      !this.firstNameError() &&
      !this.aliasError() &&
      !this.emailError() &&
      !this.hasArrayErrors()
    );
  });

  // Stage 1 Detection
  hasAnyContent = computed(() => {
    return (
      !!this.firstName().trim() ||
      !!this.surname().trim() ||
      !!this.alias().trim() ||
      !!this.email().trim() ||
      this.emailAddresses().length > 0 ||
      this.phoneNumbers().length > 0
    );
  });

  saveTooltip = computed(() => {
    if (!this.hasAnyContent()) return 'Enter contact details';
    if (this.isValid()) return 'Save Contact';

    if (this.firstNameError()) return 'Missing: First Name';
    if (this.aliasError()) return 'Missing: Alias';
    if (this.emailError()) return 'Invalid: Primary Email';

    return 'Please complete required fields';
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
        const c = this.contact();
        if (c) {
          this.firstName.set(c.firstName ?? '');
          this.surname.set(c.surname ?? '');
          this.alias.set(c.alias ?? '');
          this.email.set(c.email ?? '');
          this.emailAddresses.set([...(c.emailAddresses ?? [])]);
          this.phoneNumbers.set([...(c.phoneNumbers ?? [])]);
        } else {
          this.resetForm();
        }
      },
      { allowSignalWrites: true },
    );
  }

  // --- ACTIONS ---

  // [RESTORED] Handles transition to edit mode + scrolling
  enterEditMode(): void {
    this.isEditing.set(true);
    this.el.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  addEmailAddress(): void {
    this.emailAddresses.update((list) => [...list, '']);
  }

  removeEmailAddress(index: number): void {
    this.emailAddresses.update((list) => list.filter((_, i) => i !== index));
  }

  updateEmailAddress(index: number, value: string): void {
    this.emailAddresses.update((list) => {
      const copy = [...list];
      copy[index] = value;
      return copy;
    });
  }

  addPhoneNumber(): void {
    this.phoneNumbers.update((list) => [...list, '']);
  }

  removePhoneNumber(index: number): void {
    this.phoneNumbers.update((list) => list.filter((_, i) => i !== index));
  }

  updatePhoneNumber(index: number, value: string): void {
    this.phoneNumbers.update((list) => {
      const copy = [...list];
      copy[index] = value;
      return copy;
    });
  }

  onSave(): void {
    this.firstNameTouched.set(true);
    this.aliasTouched.set(true);
    this.emailTouched.set(true);

    if (!this.isValid()) {
      this.jumpToFirstError();
      return;
    }

    if (this.contact()) {
      const updated: Contact = {
        ...this.contact()!,
        firstName: this.firstName(),
        surname: this.surname(),
        alias: this.alias(),
        email: this.email(),
        emailAddresses: this.emailAddresses(),
        phoneNumbers: this.phoneNumbers(),
      };
      this.save.emit(updated);

      // ✅ FIX: If editing an existing contact, exit edit mode now.
      // If creating a new contact, we don't care because the component will be destroyed/navigated.
      if (!this.startInEditMode()) {
        this.isEditing.set(false);
      }
    }
  }

  onDelete(): void {
    this.delete.emit();
  }

  onCancel(): void {
    // If creating new, emit cancel (Page handles navigation)
    if (this.startInEditMode()) {
      this.cancel.emit();
      return;
    }
    // If editing existing, just exit edit mode
    this.isEditing.set(false);

    // Reset form to original value
    const c = this.contact();
    if (c) {
      this.firstName.set(c.firstName ?? '');
      this.surname.set(c.surname ?? '');
      this.alias.set(c.alias ?? '');
      this.email.set(c.email ?? '');
      this.emailAddresses.set([...(c.emailAddresses ?? [])]);
      this.phoneNumbers.set([...(c.phoneNumbers ?? [])]);
    }
  }

  private jumpToFirstError() {
    const invalidInput = this.el.nativeElement.querySelector(
      '.field-invalid input',
    );
    if (invalidInput) {
      invalidInput.focus();
    }
  }

  private resetForm() {
    this.firstName.set('');
    this.surname.set('');
    this.alias.set('');
    this.email.set('');
    this.emailAddresses.set([]);
    this.phoneNumbers.set([]);
    this.firstNameTouched.set(false);
    this.aliasTouched.set(false);
    this.emailTouched.set(false);
  }

  getStatusIcon(field: 'firstName' | 'surname' | 'alias' | 'email'): string {
    if (!this.isEditing()) return '';

    let value = '';
    let error: string | null = null;
    let touched = false;
    let required = false;

    switch (field) {
      case 'firstName':
        value = this.firstName();
        error = this.firstNameError();
        touched = this.firstNameTouched();
        required = true;
        break;
      case 'surname':
        value = this.surname();
        required = false;
        break;
      case 'alias':
        value = this.alias();
        error = this.aliasError();
        touched = this.aliasTouched();
        required = true;
        break;
      case 'email':
        value = this.email();
        error = this.emailError();
        touched = this.emailTouched();
        required = true;
        break;
    }

    if (!error && value) return 'check_circle';
    if (error && touched) return 'error';
    if (required && !value && !touched) return 'priority_high';

    return '';
  }

  getStatusColor(field: 'firstName' | 'surname' | 'alias' | 'email'): string {
    const icon = this.getStatusIcon(field);
    switch (icon) {
      case 'check_circle':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'priority_high':
        return 'text-amber-500 font-bold';
      default:
        return '';
    }
  }

  getProviderName(urn: URN): string {
    return urn.toString().split(':')[2] || 'Unknown';
  }

  getProviderId(urn: URN): string {
    return urn.toString().split(':')[3] || 'Unknown';
  }
}
