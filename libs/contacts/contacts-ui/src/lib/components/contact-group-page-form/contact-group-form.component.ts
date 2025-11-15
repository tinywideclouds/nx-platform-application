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
} from '@nx-platform-application/contacts-data-access';
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

  form: FormGroup = this.fb.group({
    id: [''],
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

  groupMembers = computed(() => {
    const membersMap = new Map(this.allContacts().map((c) => [c.id, c]));
    const contactIds = this.contactIdsValue() ?? [];

    return contactIds
      .map((id: string) => membersMap.get(id))
      .filter((c: Contact): c is Contact => Boolean(c));
  });

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

  getInitials(contact: Contact): string {
    const first = contact.firstName?.[0] || '';
    const last = contact.surname?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }

  getProfilePicture(contact: Contact): string | undefined {
    return contact.serviceContacts['messenger']?.profilePictureUrl;
  }
}