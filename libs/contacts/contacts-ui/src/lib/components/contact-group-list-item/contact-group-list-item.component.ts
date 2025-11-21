// libs/contacts/contacts-ui/src/lib/components/contact-group-list-item/contact-group-list-item.component.ts

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContactGroup } from '@nx-platform-application/contacts-access';

@Component({
  selector: 'contacts-group-list-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contact-group-list-item.component.html',
  // We'll create a new .scss file for this
  styleUrl: './contact-group-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactGroupListItemComponent {
  @Input({ required: true }) group!: ContactGroup;
  @Output() select = new EventEmitter<ContactGroup>();

  @HostListener('click')
  onHostClick(): void {
    this.select.emit(this.group);
  }

  /**
   * Getter for displaying the member count.
   */
  get memberCount(): number {
    return this.group.contactIds.length;
  }
}
