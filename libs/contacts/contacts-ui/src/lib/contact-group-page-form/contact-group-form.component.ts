// libs/contacts/contacts-ui/src/lib/components/contact-group-page-form/contact-group-form.component.ts

import {
  Component,
  input,
  output,
  effect,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-storage';
// --- 1. Import URN ---
import { URN } from '@nx-platform-application/platform-types';
import { ContactMultiSelectorComponent } from '../contact-multi-selector/contact-multi-selector.component';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

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
    ContactAvatarComponent,
  ],
  templateUrl: './contact-group-form.component.html',
  styleUrl: './contact-group-form.component.scss',
})
export class ContactGroupFormComponent {
  group = input<ContactGroup | null>(null);
  allContacts = input.required<Contact[]>();
  startInEditMode = input(false);
  save = output<ContactGroup>();

  private fb = inject(FormBuilder);
  isEditing = signal(false);

  // The form is kept identical to the original: it holds string IDs
  form: FormGroup = this.fb.group({
    id: [''], // This will hold the string version of the URN
    name: ['', Validators.required],
    description: [''],
    contactIds: [[] as string[]],
  });

  private contactIdsValue = toSignal(
    this.form.get('contactIds')!.valueChanges,
    { initialValue: this.form.get('contactIds')!.value }
  );

  constructor() {
    this.form.disable();

    effect(() => {
      this.isEditing.set(this.startInEditMode());
    });

    // --- 2. Update Input effect ---
    effect(() => {
      const currentGroup = this.group();
      if (currentGroup) {
        // Convert URNs to strings before patching the form
        this.form.patchValue({
          id: currentGroup.id.toString(),
          name: currentGroup.name,
          description: currentGroup.description,
          contactIds: currentGroup.contactIds.map((id) => id.toString()),
        });
      } else {
        // Reset to primitives
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
        // --- 3. Update Reset effect ---
        if (this.group()) {
          const currentGroup = this.group()!;
          // Convert URNs to strings before resetting the form
          this.form.reset({
            id: currentGroup.id.toString(),
            name: currentGroup.name,
            description: currentGroup.description,
            contactIds: currentGroup.contactIds.map((id) => id.toString()),
          });
        }
      }
    });
  }

  // --- 4. Update computed property ---
  groupMembers = computed(() => {
    // Create the Map using string keys
    const membersMap = new Map(
      this.allContacts().map((c) => [c.id.toString(), c])
    );
    // Get the string[] from the form
    const contactIds = this.contactIdsValue() ?? [];

    // This logic now works perfectly
    return contactIds
      .map((id: string) => membersMap.get(id))
      .filter((c: Contact | undefined): c is Contact => Boolean(c));
  });

  // --- 5. Update Output method ---
  onSave(): void {
    if (this.form.valid) {
      const formValue = this.form.value;
      const originalGroup = this.group();

      // We must construct a valid ContactGroup to emit
      this.save.emit({
        // Spread the original group to preserve non-form properties
        ...originalGroup,
        // The ID is the original URN, not the string from the form
        id: originalGroup!.id,
        name: formValue.name,
        description: formValue.description,
        // Convert string[] from form back to URN[]
        contactIds: formValue.contactIds.map((id: string) => URN.parse(id)),
      });
    }
  }

  onCancel(): void {
    this.isEditing.set(false);
  }

  // --- 6. Add trackBy function ---
  trackContactById(index: number, contact: Contact): string {
    return contact.id.toString();
  }

  getInitials(contact: Contact): string {
    const first = contact.firstName?.[0] || '';
    const last = contact.surname?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }

  getProfilePicture(contact: Contact): string | undefined {
    return contact.serviceContacts['messenger']?.profilePictureUrl;
  }
}
