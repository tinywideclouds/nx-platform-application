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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

// FORM COMPONENTS & VALIDATION
import { EditableListComponent } from '@nx-platform-application/platform-ui-forms';
import {
  EmailSchema,
  NameSchema,
  AliasSchema,
  PhoneSchema,
  computedError,
} from '@nx-platform-application/platform-ui-forms';

@Component({
  selector: 'contacts-form',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    EditableListComponent,
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactFormComponent {
  private el = inject(ElementRef);

  // --- SCHEMAS ---
  protected readonly EmailSchema = EmailSchema;
  protected readonly PhoneSchema = PhoneSchema;

  // --- INPUTS ---
  contact = input<Contact | null>(null);
  linkedIdentities = input<URN[]>([]);
  isEditing = input.required<boolean>();
  isNew = input(false);

  // --- OUTPUTS ---
  save = output<Contact>();
  delete = output<void>();
  errorsChange = output<number>(); // Emits the count of errors

  // --- FORM STATE ---
  firstName = signal('');
  firstNameTouched = signal(false);

  surname = signal('');

  alias = signal('');
  aliasTouched = signal(false);

  email = signal('');
  emailTouched = signal(false);

  phoneNumber = signal('');
  phoneNumberTouched = signal(false);

  // Lists
  emailAddresses = signal<string[]>([]);
  phoneNumbers = signal<string[]>([]);

  // --- UX-09: BREADCRUMBS ---
  firstNameModified = computed(
    () =>
      !this.isNew() && this.firstName() !== (this.contact()?.firstName ?? ''),
  );
  surnameModified = computed(
    () => !this.isNew() && this.surname() !== (this.contact()?.surname ?? ''),
  );
  aliasModified = computed(
    () => !this.isNew() && this.alias() !== (this.contact()?.alias ?? ''),
  );
  emailModified = computed(
    () => !this.isNew() && this.email() !== (this.contact()?.email ?? ''),
  );
  phoneModified = computed(
    () =>
      !this.isNew() &&
      this.phoneNumber() !== (this.contact()?.phoneNumber ?? ''),
  );

  // --- VALIDATION ---
  firstNameError = computedError(NameSchema, this.firstName);
  aliasError = computedError(AliasSchema, this.alias);
  emailError = computedError(EmailSchema, this.email);

  // RAW validation from schema
  private _phoneSchemaError = computedError(PhoneSchema, this.phoneNumber);

  // STRICT OPTIONALITY: If empty, it is VALID. Ignore schema 'required' if present.
  phoneError = computed(() => {
    return this.phoneNumber() ? this._phoneSchemaError() : null;
  });

  // Count active errors
  errorCount = computed(() => {
    let count = 0;
    if (this.firstNameError()) count++;
    if (this.aliasError()) count++;
    if (this.emailError()) count++;
    if (this.phoneError()) count++;
    return count;
  });

  isValid = computed(() => this.errorCount() === 0);

  // --- CONSTRUCTOR & EFFECT ---
  constructor() {
    effect(() => {
      const c = this.contact();
      if (c) {
        this.firstName.set(c.firstName ?? '');
        this.surname.set(c.surname ?? '');
        this.alias.set(c.alias ?? '');
        this.email.set(c.email ?? '');
        this.phoneNumber.set(c.phoneNumber ?? '');
        this.emailAddresses.set([...(c.emailAddresses ?? [])]);
        this.phoneNumbers.set([...(c.phoneNumbers ?? [])]);
      } else {
        this.resetForm();
      }
      this.resetTouched();
    });

    // Notify parent continuously of error count
    effect(() => {
      this.errorsChange.emit(this.errorCount());
    });
  }

  // --- PUBLIC API ---

  triggerSave(): void {
    this.markAllTouched();

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
        phoneNumber: this.phoneNumber(),
        emailAddresses: this.emailAddresses(),
        phoneNumbers: this.phoneNumbers(),
      };
      this.save.emit(updated);
    }
  }

  onDelete(): void {
    this.delete.emit();
  }

  // --- PRIVATE HELPERS ---

  private jumpToFirstError() {
    const invalidInput = this.el.nativeElement.querySelector(
      '.field-invalid input',
    );
    if (invalidInput) invalidInput.focus();
  }

  private resetForm() {
    this.firstName.set('');
    this.surname.set('');
    this.alias.set('');
    this.email.set('');
    this.phoneNumber.set('');
    this.emailAddresses.set([]);
    this.phoneNumbers.set([]);
  }

  private resetTouched() {
    this.firstNameTouched.set(false);
    this.aliasTouched.set(false);
    this.emailTouched.set(false);
    this.phoneNumberTouched.set(false);
  }

  private markAllTouched() {
    this.firstNameTouched.set(true);
    this.aliasTouched.set(true);
    this.emailTouched.set(true);
    this.phoneNumberTouched.set(true);
  }

  // --- SMART TRAFFIC LIGHT SYSTEM ---

  getStatusIcon(
    field: 'firstName' | 'alias' | 'email' | 'phoneNumber',
  ): string {
    if (!this.isEditing()) return '';

    // 1. Error State
    if (
      field === 'firstName' &&
      this.firstNameError() &&
      this.firstNameTouched()
    )
      return 'error';
    if (field === 'alias' && this.aliasError() && this.aliasTouched())
      return 'error';
    if (field === 'email' && this.emailError() && this.emailTouched())
      return 'error';
    if (
      field === 'phoneNumber' &&
      this.phoneError() &&
      this.phoneNumberTouched()
    )
      return 'error';

    // 2. Modified State
    if (field === 'firstName' && this.firstNameModified()) return 'edit_note';
    if (field === 'alias' && this.aliasModified()) return 'edit_note';
    if (field === 'email' && this.emailModified()) return 'edit_note';
    if (field === 'phoneNumber' && this.phoneModified()) return 'edit_note';

    // 3. Valid State
    const hasValue =
      field === 'firstName'
        ? !!this.firstName()
        : field === 'alias'
          ? !!this.alias()
          : field === 'email'
            ? !!this.email()
            : !!this.phoneNumber();

    if (hasValue) return 'check_circle';

    return '';
  }

  getStatusColor(
    field: 'firstName' | 'alias' | 'email' | 'phoneNumber',
  ): string {
    const icon = this.getStatusIcon(field);
    switch (icon) {
      case 'error':
        return 'text-red-600';
      case 'edit_note':
        return 'text-blue-600 font-bold';
      case 'check_circle':
        return 'text-green-600';
      default:
        return '';
    }
  }

  getStatusTooltip(
    field: 'firstName' | 'alias' | 'email' | 'phoneNumber',
  ): string {
    if (field === 'firstName' && this.firstNameError())
      return this.firstNameError()!;
    if (field === 'alias' && this.aliasError()) return this.aliasError()!;
    if (field === 'email' && this.emailError()) return this.emailError()!;
    if (field === 'phoneNumber' && this.phoneError()) return this.phoneError()!;

    if (field === 'firstName' && this.firstNameModified()) return 'Modified';
    if (field === 'alias' && this.aliasModified()) return 'Modified';
    if (field === 'email' && this.emailModified()) return 'Modified';
    if (field === 'phoneNumber' && this.phoneModified()) return 'Modified';

    return '';
  }
}
