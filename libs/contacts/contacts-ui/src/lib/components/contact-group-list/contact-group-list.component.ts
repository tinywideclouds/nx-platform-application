import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContactGroup } from '@nx-platform-application/contacts-access';
import { ContactGroupListItemComponent } from '../contact-group-list-item/contact-group-list-item.component';

@Component({
  selector: 'contacts-group-list',
  standalone: true,
  imports: [CommonModule, ContactGroupListItemComponent],
  templateUrl: './contact-group-list.component.html',
  styleUrl: './contact-group-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactGroupListComponent {
  groups = input.required<ContactGroup[]>();
  
  groupSelected = output<ContactGroup>();

  onSelect(group: ContactGroup): void {
    this.groupSelected.emit(group);
  }

  trackGroupById(index: number, group: ContactGroup): string {
    return group.id.toString();
  }
}