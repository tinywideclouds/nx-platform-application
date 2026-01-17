import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Contact } from '@nx-platform-application/contacts-types';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { SwipeableItemComponent } from '@nx-platform-application/platform-ui-lists';

@Component({
  selector: 'contacts-list-item',
  standalone: true,
  imports: [
    CommonModule,
    ContactAvatarComponent,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    SwipeableItemComponent,
  ],
  templateUrl: './contact-list-item.component.html',
  styleUrl: './contact-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactListItemComponent {
  // --- INPUTS & OUTPUTS ---
  contact = input.required<Contact>();
  select = output<Contact>();
  delete = output<Contact>();
  edit = output<Contact>();
  swipeStart = output<void>();

  // --- QUERIES ---
  // [FIX] Restore the menu trigger query for smart hover logic
  menuTrigger = viewChild<MatMenuTrigger>('menuTrigger');
  swipeItem = viewChild<SwipeableItemComponent>('swipeItem');

  // --- STATE ---
  private closeTimer: any;

  // --- COMPUTED ---
  initials = computed(() => {
    const c = this.contact();
    return (
      ((c.firstName?.[0] || '') + (c.surname?.[0] || '')).toUpperCase() || '?'
    );
  });

  profilePictureUrl = computed(() => {
    return this.contact().serviceContacts['messenger']?.profilePictureUrl;
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
    this.select.emit(this.contact());
  }

  onEditClick(): void {
    this.edit.emit(this.contact());
  }

  onDeleteClick(event?: Event): void {
    event?.stopPropagation();
    this.delete.emit(this.contact());
  }

  // --- SMART MENU LOGIC (Restored) ---
  onMouseLeave(): void {
    const trigger = this.menuTrigger();

    // Only start the close timer if the menu is actually open
    if (trigger?.menuOpen) {
      this.closeTimer = setTimeout(() => {
        trigger.closeMenu();
      }, 200); // 200ms grace period to get to the menu
    }
  }

  // Called when mouse enters the actual dropdown menu
  onMenuEnter(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  // Called when mouse leaves the actual dropdown menu
  onMenuLeave(): void {
    // Treat leaving the menu the same as leaving the item
    this.onMouseLeave();
  }

  onContextMenu(event: MouseEvent): void {
    // Stop the browser's standard right-click menu
    event.preventDefault();

    // Open the Material menu using your signal viewChild
    this.menuTrigger()?.openMenu();
  }
}
