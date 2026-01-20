import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';

import { Contact } from '@nx-platform-application/contacts-types';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';
import { DiscardIntention } from '@nx-platform-application/platform-ux-intention';

@Component({
  selector: 'contacts-list',
  standalone: true,
  imports: [ContactListItemComponent],
  templateUrl: './contact-list.component.html',
  styleUrl: './contact-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [DiscardIntention],
})
export class ContactListComponent {
  contacts = input.required<Contact[]>();
  selectedId = input<string | undefined>(undefined);

  contactSelected = output<Contact>();
  contactDeleted = output<Contact>();
  contactEditRequested = output<Contact>();

  // Track the currently open component so we can close it
  private activeItem: ContactListItemComponent | null = null;

  async onSelect(contact: Contact) {
    // FIX: Instant cleanup when clicking a row.
    // This ensures the list is clean when/if we return to it.
    await this.resetOpenItems(false);
    this.contactSelected.emit(contact);
  }

  onDelete(contact: Contact): void {
    this.contactDeleted.emit(contact);
  }

  // Accordion Logic: Close previous item when a new one opens
  onItemSwipeStart(item: ContactListItemComponent): void {
    if (this.activeItem && this.activeItem !== item) {
      this.activeItem.reset();
    }
    this.activeItem = item;
  }

  /**
   * Resets currently open item.
   * @param animate - Pass false to snap instantly (e.g. before navigation)
   */
  resetOpenItems(animate = true): Promise<void> {
    if (this.activeItem) {
      const promise = this.activeItem.reset(animate);
      this.activeItem = null;
      return promise;
    }
    return Promise.resolve();
  }

  trackContactById(index: number, contact: Contact): string {
    return contact.id.toString();
  }
}
