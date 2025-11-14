import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContactGroup } from '@nx-platform-application/contacts-data-access';
import { ContactGroupListItemComponent } from '../contact-group-list-item/contact-group-list-item.component';

@Component({
  selector: 'lib-contact-group-list',
  standalone: true,
  imports: [CommonModule, ContactGroupListItemComponent], // Import our new list item
  templateUrl: './contact-group-list.component.html',
  styleUrl: './contact-group-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactGroupListComponent {
  @Input({ required: true }) groups!: ContactGroup[];
  @Output() groupSelected = new EventEmitter<ContactGroup>();

  /**
   * This method acts as a pass-through, bubbling the event
   * from the list item up to the parent component.
   */
  onSelect(group: ContactGroup): void {
    this.groupSelected.emit(group);
  }
}