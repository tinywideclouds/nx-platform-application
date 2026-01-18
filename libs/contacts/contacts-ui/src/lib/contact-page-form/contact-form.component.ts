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
  contact = input.required<Contact>();
  linkedIdentities = input<any[]>([]);
  startInEditMode = input(false);

  // --- OUTPUTS ---
  save = output<Contact>();
  delete = output<void>();
  cancel = output<void>();

  // --- FORM STATE (Signals) ---
  // We initialize these in the constructor effect
  firstName = signal('');
  surname = signal('');
  alias = signal('');
  email = signal('');

  phoneNumbers = signal<string[]>([]);

  // Touched States
  firstNameTouched = signal(false);
  aliasTouched = signal(false);
  emailTouched = signal(false);

  // --- UX-09: THE BREADCRUMB TRAIL (Modified State) ---
  // Compares current signal value vs the 'contact' input (Source of Truth)
  firstNameModified = computed(
    () => this.firstName() !== this.contact().firstName,
  );
  surnameModified = computed(
    () => this.surname() !== (this.contact().surname || ''),
  );
  aliasModified = computed(() => this.alias() !== this.contact().alias);
  emailModified = computed(() => this.email() !== this.contact().email);

  // --- VALIDATION ---
  firstNameError = computed(() =>
    !this.firstName() ? 'First Name is required' : null,
  );

  aliasError = computed(() => (!this.alias() ? 'Alias is required' : null));

  emailError = computed(() => {
    if (!this.email()) return 'Email is required';
    if (!FormValidators.isValidEmail(this.email()))
      return 'Invalid email format';
    return null;
  });

  isValid = computed(
    () => !this.firstNameError() && !this.aliasError() && !this.emailError(),
  );

  hasAnyContent = computed(
    () =>
      !!this.firstName() ||
      !!this.surname() ||
      !!this.alias() ||
      !!this.email(),
  );

  // Computed Tooltip for the Save Button
  saveTooltip = computed(() => {
    if (!this.hasAnyContent()) return 'Form is empty';
    if (!this.isValid()) return 'Please fix errors before saving';
    return 'Save Contact';
  });

  // --- SYNC LOGIC ---
  constructor() {
    // Reset form when the Contact Input changes (Navigation)
    effect(
      () => {
        const c = this.contact();
        // Use untracked if strictly needed, but here we want to react to 'c'
        this.firstName.set(c.firstName || '');
        this.surname.set(c.surname || '');
        this.alias.set(c.alias || '');
        this.email.set(c.email || '');
        this.phoneNumbers.set([...(c.phoneNumbers || [])]);

        // Reset interaction state
        this.firstNameTouched.set(false);
        this.aliasTouched.set(false);
        this.emailTouched.set(false);
      },
      { allowSignalWrites: true },
    );
  }

  // --- UI HELPERS ---
  isEditing = computed(
    () =>
      this.startInEditMode() ||
      this.firstNameModified() || // Auto-switch to "Edit UI" if modified
      this.surnameModified() ||
      this.aliasModified() ||
      this.emailModified(),
  );

  /**
   * UX-04: The Traffic Light System
   * Now enhanced with UX-09 (Modified) logic if needed,
   * but we handle the "Blue Bar" in CSS/HTML mostly.
   */
  getStatusIcon(field: 'firstName' | 'surname' | 'alias' | 'email'): string {
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
        return 'text-amber-500';
      default:
        return 'text-gray-400';
    }
  }

  // --- ACTIONS ---
  onSave(): void {
    if (!this.isValid()) return;

    const updated: Contact = {
      ...this.contact(),
      firstName: this.firstName(),
      surname: this.surname(),
      alias: this.alias(),
      email: this.email(),
      phoneNumbers: this.phoneNumbers(),
    };
    this.save.emit(updated);
  }

  onDelete(): void {
    this.delete.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  addPhoneNumber(): void {
    this.phoneNumbers.update((nums) => [...nums, '']);
  }
}
