import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';

import { ContactGroup } from '@nx-platform-application/contacts-types';
import { ContactGroupListItemComponent } from '../contact-group-list-item/contact-group-list-item.component';
import { GroupBadgeResolver } from './../models/group-badge.model';

@Component({
  selector: 'contacts-group-list',
  standalone: true,
  imports: [ContactGroupListItemComponent],
  templateUrl: './contact-group-list.component.html',
  styleUrl: './contact-group-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactGroupListComponent {
  groups = input.required<ContactGroup[]>();
  selectedId = input<string | undefined>(undefined);

  // ✅ NEW: Threading Input
  badgeResolver = input<GroupBadgeResolver | undefined>(undefined);

  groupSelected = output<ContactGroup>();

  onSelect(group: ContactGroup): void {
    this.groupSelected.emit(group);
  }

  trackGroupById(index: number, group: ContactGroup): string {
    return group.id.toString();
  }
}
