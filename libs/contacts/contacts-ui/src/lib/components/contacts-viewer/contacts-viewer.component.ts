import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
  PendingIdentity,
  BlockedIdentity,
} from '@nx-platform-application/contacts-access';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { PendingListComponent } from '../pending-list/pending-list.component';
import { BlockedListComponent } from '../blocked-list/blocked-list.component';
import { ContactDetailComponent } from '../contact-detail/contact-detail.component';

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
    PendingListComponent,
    BlockedListComponent,
    ContactDetailComponent
  ],
  templateUrl: './contacts-viewer.component.html',
  styleUrl: './contacts-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsViewerComponent {
  private contactsService = inject(ContactsStorageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // --- CONFIG INPUTS ---
  
  /** If true, clicking a contact emits an event instead of navigating/selecting. */
  selectionMode = input(false);

  /** Passed down to the toolbar to force icon-only buttons. */
  forceToolbarIcons = input(false);

  /** * If true, disables the Split-View (Master/Detail) logic entirely.
   * Use this when embedding the viewer in a sidebar (e.g. Messenger App).
   */
  forceSidebar = input(false);

  // --- ROUTER INPUT ---
  
  /** * The ID of the currently selected item (Contact or Group).
   * Populated automatically from the URL query param `?selectedId=...`
   */
  selectedId = input<string | undefined>(undefined);

  // --- OUTPUTS ---
  
  contactSelected = output<Contact>();
  groupSelected = output<ContactGroup>();

  // --- DATA STATE ---

  contacts = toSignal<Contact[]>(this.contactsService.contacts$, {
    initialValue: undefined
  });
  groups = toSignal<ContactGroup[]>(this.contactsService.groups$, {
    initialValue: undefined
  });

  pending = toSignal(this.contactsService.pending$, {
    initialValue: [] as PendingIdentity[],
  });
  blocked = toSignal(this.contactsService.blocked$, {
    initialValue: [] as BlockedIdentity[],
  });

  // --- DERIVED SELECTION STATE ---
  // We no longer set these manually. They are computed from the 'selectedId' Input.

  activeContact = computed(() => {
    const id = this.selectedId();
    const currentContacts = this.contacts();
    if (!id || !currentContacts) return null;
    return currentContacts.find(c => c.id.toString() === id) || null;
  });

  activeGroup = computed(() => {
    const id = this.selectedId();
    const currentGroups = this.groups();
    if (!id || !currentGroups) return null;
    return currentGroups.find(g => g.id.toString() === id) || null;
  });

  // --- TAB LOGIC ---

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
      replaceUrl: true, 
      queryParams: { 
        tab,
        selectedId: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  // --- SELECTION ACTIONS ---

  onContactSelect(contact: Contact, isWideMode: boolean): void {
    // 1. Selection Mode (Messenger Sidebar)
    if (this.selectionMode()) {
      this.contactSelected.emit(contact);
      return;
    }

    // 2. Split View Mode (Contacts App Desktop)
    if (isWideMode && !this.forceSidebar()) {
      // Update the URL Query Param. The Router will reflect this back into 'selectedId' input.
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { selectedId: contact.id.toString() },
        queryParamsHandling: 'merge', // Keep active tab
      });
    } 
    // 3. Navigation Mode (Mobile)
    else {
      this.router.navigate(['edit', contact.id.toString()], {
        relativeTo: this.route,
      });
    }
  }

  onGroupSelect(group: ContactGroup, isWideMode: boolean): void {
    if (this.selectionMode()) {
      this.groupSelected.emit(group);
      return;
    }

    if (isWideMode && !this.forceSidebar()) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { selectedId: group.id.toString() },
        queryParamsHandling: 'merge',
      });
    } else {
      this.router.navigate(['group-edit', group.id.toString()], {
        relativeTo: this.route,
      });
    }
  }

  // --- GATEKEEPER ACTIONS ---

  async approveIdentity(pending: PendingIdentity): Promise<void> {
    await this.contactsService.deletePending(pending.urn);
  }

  async blockPending(pending: PendingIdentity): Promise<void> {
    await this.contactsService.blockIdentity(
      pending.urn,
      'Blocked via Manager'
    );
    await this.contactsService.deletePending(pending.urn);
  }

  async unblockIdentity(blocked: BlockedIdentity): Promise<void> {
    await this.contactsService.unblockIdentity(blocked.urn);
  }
}