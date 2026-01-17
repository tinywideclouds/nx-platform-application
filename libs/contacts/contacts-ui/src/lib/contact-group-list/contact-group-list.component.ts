import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';

import { trigger, transition, style, animate } from '@angular/animations';

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

  animations: [
    trigger('deleteAnimation', [
      transition(':leave', [
        style({ height: '*', opacity: 1, overflow: 'hidden' }),
        animate(
          '300ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ height: '0px', opacity: 0, paddingTop: 0, paddingBottom: 0 }),
        ),
      ]),
    ]),
  ],
})
export class ContactGroupListComponent {
  groups = input.required<ContactGroup[]>();
  selectedId = input<string | undefined>(undefined);
  badgeResolver = input<GroupBadgeResolver | undefined>(undefined);

  groupSelected = output<ContactGroup>();
  groupDeleted = output<ContactGroup>();
  groupEditRequested = output<ContactGroup>();

  // Track the currently open component so we can close it
  private activeItem: ContactGroupListItemComponent | null = null;

  async onSelect(group: ContactGroup) {
    // BLOCKING: Wait for the row to snap shut before navigating.
    await this.resetOpenItems(false);
    this.groupSelected.emit(group);
  }

  // Accordion Logic: Close previous item when a new one opens
  onItemSwipeStart(item: ContactGroupListItemComponent): void {
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

  trackGroupById(index: number, group: ContactGroup): string {
    return group.id.toString();
  }
}
