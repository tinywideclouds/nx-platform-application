import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Contact } from '@nx-platform-application/contacts-access';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';

@Component({
  selector: 'contacts-list',
  standalone: true,
  imports: [CommonModule, ContactListItemComponent],
  templateUrl: './contact-list.component.html',
  styleUrl: './contact-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactListComponent {
  contacts = input.required<Contact[]>();
  
  /** * The ID of the currently selected contact (as a string).
   * Used to apply active styling to the row.
   */
  selectedId = input<string | undefined>(undefined);

  contactSelected = output<Contact>();

  onSelect(contact: Contact): void {
    this.contactSelected.emit(contact);
  }

  trackContactById(index: number, contact: Contact): string {
    return contact.id.toString();
  }
}