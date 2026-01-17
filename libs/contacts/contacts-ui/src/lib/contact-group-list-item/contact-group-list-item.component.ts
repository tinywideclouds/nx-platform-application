import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { ContactGroup } from '@nx-platform-application/contacts-types';
import { GroupBadgeResolver } from './../models/group-badge.model';
import { SwipeableItemComponent } from '@nx-platform-application/platform-ui-lists';

@Component({
  selector: 'contacts-group-list-item',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTooltipModule,
    MatBadgeModule,
    MatMenuModule,
    MatButtonModule,
    SwipeableItemComponent,
  ],
  templateUrl: './contact-group-list-item.component.html',
  styleUrl: './contact-group-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
})
export class ContactGroupListItemComponent {
  // --- INPUTS & OUTPUTS ---
  group = input.required<ContactGroup>();
  badgeResolver = input<GroupBadgeResolver | undefined>(undefined);

  select = output<ContactGroup>();
  delete = output<ContactGroup>();
  edit = output<ContactGroup>();
  swipeStart = output<void>();

  // --- QUERIES ---
  // [FIX] Use string selector for safety
  menuTrigger = viewChild<MatMenuTrigger>('menuTrigger');
  swipeItem = viewChild<SwipeableItemComponent>('swipeItem');

  // --- STATE ---
  private closeTimer: any;

  // --- COMPUTED ---
  memberCount = computed(() => this.group().members.length);

  badges = computed(() => {
    const resolver = this.badgeResolver();
    const g = this.group();
    return resolver ? resolver(g) : [];
  });

  // --- PUBLIC API ---
  async reset(animate = true): Promise<void> {
    const item = this.swipeItem();
    if (item) {
      await item.reset(animate);
    }
  }

  // --- HANDLERS ---
  onContentClick(): void {
    this.select.emit(this.group());
  }

  onEditClick(): void {
    this.edit.emit(this.group());
  }

  onDeleteClick(event?: Event): void {
    event?.stopPropagation();
    this.delete.emit(this.group());
  }

  // --- SMART MENU LOGIC ---
  onMouseLeave(): void {
    const trigger = this.menuTrigger();
    if (trigger?.menuOpen) {
      this.closeTimer = setTimeout(() => {
        trigger.closeMenu();
      }, 200);
    }
  }

  onMenuEnter(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  onMenuLeave(): void {
    this.onMouseLeave();
  }
}
