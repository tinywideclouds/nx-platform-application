import {
  Component,
  input,
  output,
  effect,
  inject,
  signal,
  computed,
} from '@angular/core';

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
  ContactGroupMember,
} from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { ContactMultiSelectorComponent } from '../contact-multi-selector/contact-multi-selector.component';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox'; // ✅ Material Checkbox
import { MatIconModule } from '@angular/material/icon';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

@Component({
  selector: 'contacts-group-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    // Note: No FormsModule here. strictly signals.
    ContactMultiSelectorComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatIconModule,
    ContactAvatarComponent,
  ],
  templateUrl: './contact-group-form.component.html',
  styleUrl: './contact-group-form.component.scss',
})
export class ContactGroupFormComponent {
  group = input<ContactGroup | null>(null);
  allContacts = input.required<Contact[]>();

  // ✅ NEW: To display recursive delete option
  linkedChildrenCount = input(0);

  startInEditMode = input(false);
  readonly = input(false);

  save = output<ContactGroup>();

  // ✅ NEW: Emits true if recursive delete is requested
  delete = output<{ recursive: boolean }>();

  private fb = inject(FormBuilder);
  isEditing = signal(false);

  // ✅ Pure Signal State for the checkbox
  deleteRecursive = signal(true);

  // The form is kept identical to the original: it holds string IDs
  form: FormGroup = this.fb.group({
    id: [''],
    name: ['', Validators.required],
    description: [''],
    contactIds: [[] as string[]],
  });

  private contactIdsValue = toSignal(
    this.form.get('contactIds')!.valueChanges,
    { initialValue: this.form.get('contactIds')!.value },
  );

  constructor() {
    this.form.disable();

    effect(() => {
      this.isEditing.set(this.startInEditMode());
    });

    effect(() => {
      const currentGroup = this.group();
      if (currentGroup) {
        this.form.patchValue({
          id: currentGroup.id.toString(),
          name: currentGroup.name,
          description: currentGroup.description,
          contactIds: currentGroup.members.map((m) => m.contactId.toString()),
        });
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
          const currentGroup = this.group()!;
          this.form.reset({
            id: currentGroup.id.toString(),
            name: currentGroup.name,
            description: currentGroup.description,
            contactIds: currentGroup.members.map((id) => id.toString()),
          });
        }
      }
    });
  }

  groupMembers = computed(() => {
    const membersMap = new Map(
      this.allContacts().map((c) => [c.id.toString(), c]),
    );
    const contactIds = this.contactIdsValue() ?? [];
    return contactIds
      .map((id: string) => membersMap.get(id))
      .filter((c: Contact | undefined): c is Contact => Boolean(c));
  });

  onSave(): void {
    if (this.form.valid) {
      const formValue = this.form.value;
      const originalGroup = this.group();
      if (!originalGroup) return;

      const selectedIdStrings = formValue.contactIds as string[];
      const updatedMembers: ContactGroupMember[] = selectedIdStrings.map(
        (idStr) => {
          const idUrn = URN.parse(idStr);
          const existingMember = originalGroup.members.find(
            (m) => m.contactId.toString() === idStr,
          );
          if (existingMember) return existingMember;
          return {
            contactId: idUrn,
            status: 'added',
          };
        },
      );

      this.save.emit({
        ...originalGroup,
        name: formValue.name,
        description: formValue.description,
        scope: originalGroup.scope || 'local',
        members: updatedMembers,
      });
    }
  }

  // ✅ NEW: Delete Handler reads pure signal
  onDelete(): void {
    this.delete.emit({ recursive: this.deleteRecursive() });
  }

  onCancel(): void {
    this.isEditing.set(false);
  }

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
