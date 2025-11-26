import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

// MATERIAL
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// DOMAIN
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
  PendingIdentity,
  BlockedIdentity,
} from '@nx-platform-application/contacts-storage';

// UI COMPONENTS
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { PendingListComponent } from '../pending-list/pending-list.component';
import { BlockedListComponent } from '../blocked-list/blocked-list.component';

@Component({
  selector: 'contacts-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ContactsPageToolbarComponent,
    ContactListComponent,
    ContactGroupListComponent,
    PendingListComponent,
    BlockedListComponent,
  ],
  templateUrl: './contacts-sidebar.component.html',
  styleUrl: './contacts-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsSidebarComponent {
  private contactsService = inject(ContactsStorageService);

  // --- INPUTS ---

  // Highlight the active row (if any)
  selectedId = input<string | undefined>(undefined);

  // Which tab is active? (0: Contacts, 1: Groups, 2: Manage)
  tabIndex = input(0);

  // Feature Flag: Show "New Contact/Group" buttons?
  showAddActions = input(true);

  // FIX: Added missing Input to satisfy binding
  // When true, this can be used to alter UI (e.g. hide Manage tab)
  selectionMode = input(false);

  // --- OUTPUTS ---

  contactSelected = output<Contact>();
  groupSelected = output<ContactGroup>();
  tabChange = output<MatTabChangeEvent>();

  // --- DATA ---

  contacts = toSignal(this.contactsService.contacts$);
  groups = toSignal(this.contactsService.groups$);
  pending = toSignal(this.contactsService.pending$, { initialValue: [] });
  blocked = toSignal(this.contactsService.blocked$, { initialValue: [] });

  // --- ACTIONS ---

  onTabChange(event: MatTabChangeEvent) {
    this.tabChange.emit(event);
  }

  async approveIdentity(pending: PendingIdentity) {
    await this.contactsService.deletePending(pending.urn);
  }

  async blockPending(pending: PendingIdentity) {
    await this.contactsService.blockIdentity(pending.urn, 'Blocked');
    await this.contactsService.deletePending(pending.urn);
  }

  async unblockIdentity(blocked: BlockedIdentity) {
    await this.contactsService.unblockIdentity(blocked.urn);
  }
}
