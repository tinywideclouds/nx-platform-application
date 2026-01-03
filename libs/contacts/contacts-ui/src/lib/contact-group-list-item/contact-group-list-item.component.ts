import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

import { ContactGroup } from '@nx-platform-application/contacts-types';
import { GroupBadgeResolver } from './../models/group-badge.model';

@Component({
  selector: 'contacts-group-list-item',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule, MatBadgeModule],
  templateUrl: './contact-group-list-item.component.html',
  styleUrl: './contact-group-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(click)': 'onHostClick()',
    class: 'block',
  },
})
export class ContactGroupListItemComponent {
  group = input.required<ContactGroup>();

  // ✅ NEW: Adapter Input
  badgeResolver = input<GroupBadgeResolver | undefined>(undefined);

  select = output<ContactGroup>();

  memberCount = computed(() => this.group().members.length);

  // ✅ NEW: Compute Badges
  badges = computed(() => {
    const resolver = this.badgeResolver();
    const g = this.group();
    return resolver ? resolver(g) : [];
  });

  onHostClick(): void {
    this.select.emit(this.group());
  }
}
