// libs/contacts/contacts-ui/src/lib/components/contacts-viewer/contacts-viewer.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
  PendingIdentity,
  BlockedIdentity,
} from '@nx-platform-application/contacts-data-access';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

// --- NEW COMPONENTS ---
import { PendingListComponent } from '../pending-list/pending-list.component';
import { BlockedListComponent } from '../blocked-list/blocked-list.component';

@Component({
  selector: 'contacts-viewer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTabsModule,
    ContactListComponent,
    ContactGroupListComponent,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ContactsPageToolbarComponent,
    PendingListComponent, // <-- Used here
    BlockedListComponent, // <-- Used here
  ],
  templateUrl: './contacts-viewer.component.html',
  styleUrl: './contacts-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsViewerComponent {
  private contactsService = inject(ContactsStorageService) as ContactsStorageService;
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });
  groups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  pending = toSignal(this.contactsService.pending$, {
    initialValue: [] as PendingIdentity[],
  });
  blocked = toSignal(this.contactsService.blocked$, {
    initialValue: [] as BlockedIdentity[],
  });

  private queryParams = toSignal(this.route.queryParamMap);
  
  activeTab = computed(() => {
    const tab = this.queryParams()?.get('tab');
    if (tab === 'groups') return 'groups';
    if (tab === 'manage') return 'manage';
    return 'contacts';
  });

  tabIndex = computed(() => {
    const tab = this.activeTab();
    if (tab === 'groups') return 1;
    if (tab === 'manage') return 2;
    return 0;
  });

  onTabChange(event: MatTabChangeEvent): void {
    let tab = 'contacts';
    if (event.index === 1) tab = 'groups';
    if (event.index === 2) tab = 'manage';

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  onContactSelect(contact: Contact): void {
    this.router.navigate(['edit', contact.id.toString()], {
      relativeTo: this.route,
    });
  }

  onGroupSelect(group: ContactGroup): void {
    this.router.navigate(['group-edit', group.id.toString()], {
      relativeTo: this.route,
    });
  }

  async approveIdentity(pending: PendingIdentity): Promise<void> {
    await this.contactsService.deletePending(pending.urn);
  }

  async blockPending(pending: PendingIdentity): Promise<void> {
    await this.contactsService.blockIdentity(pending.urn, 'Blocked via Manager');
    await this.contactsService.deletePending(pending.urn);
  }

  async unblockIdentity(blocked: BlockedIdentity): Promise<void> {
    await this.contactsService.unblockIdentity(blocked.urn);
  }
}