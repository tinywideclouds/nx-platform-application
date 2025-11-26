// libs/contacts/contacts-ui/src/lib/components/contacts-sidebar/contacts-sidebar.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

// MATERIAL
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// DOMAIN
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
  PendingIdentity,
} from '@nx-platform-application/contacts-storage';

// CLOUD ACCESS
import {
  ContactsCloudService,
  CloudBackupMetadata,
} from '@nx-platform-application/contacts-cloud-access';

// UI COMPONENTS
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { PendingListComponent } from '../pending-list/pending-list.component';
// REMOVED: BlockedListComponent

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
    MatListModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    ContactsPageToolbarComponent,
    ContactListComponent,
    ContactGroupListComponent,
    PendingListComponent,
  ],
  templateUrl: './contacts-sidebar.component.html',
  styleUrl: './contacts-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsSidebarComponent {
  private contactsService = inject(ContactsStorageService);
  private cloudService = inject(ContactsCloudService);

  // --- INPUTS ---
  selectedId = input<string | undefined>(undefined);
  tabIndex = input(0);
  showAddActions = input(true);
  selectionMode = input(false);

  // --- OUTPUTS ---
  contactSelected = output<Contact>();
  groupSelected = output<ContactGroup>();
  tabChange = output<MatTabChangeEvent>();

  // --- DATA ---
  contacts = toSignal(this.contactsService.contacts$);
  groups = toSignal(this.contactsService.groups$);
  pending = toSignal(this.contactsService.pending$, { initialValue: [] });

  // REMOVED: blocked$ signal

  // --- CLOUD STATE ---
  isBackingUp = signal(false);
  isRestoring = signal(false);

  // Simple signal for the list, refreshed manually for now
  cloudBackups = signal<CloudBackupMetadata[]>([]);

  constructor() {
    // Initial load of backups
    if (this.cloudService.hasPermission('google')) {
      this.refreshBackups();
    }
  }

  // --- ACTIONS ---

  onTabChange(event: MatTabChangeEvent) {
    this.tabChange.emit(event);
    // Refresh backups when hitting the 'Security' tab (index 2)
    if (event.index === 2) {
      this.refreshBackups();
    }
  }

  async approveIdentity(pending: PendingIdentity) {
    await this.contactsService.deletePending(pending.urn);
  }

  async blockPending(pending: PendingIdentity) {
    await this.contactsService.blockIdentity(pending.urn, 'Blocked');
    await this.contactsService.deletePending(pending.urn);
  }

  // --- CLOUD ACTIONS ---

  async refreshBackups() {
    try {
      // Default to 'google' for this temporary UI
      const backups = await this.cloudService.listBackups('google');
      this.cloudBackups.set(backups);
    } catch (err) {
      console.error('Failed to list backups', err);
    }
  }

  async backupToCloud() {
    if (this.isBackingUp()) return;
    this.isBackingUp.set(true);
    try {
      await this.cloudService.backupToCloud('google');
      await this.refreshBackups();
    } catch (e) {
      console.error('Backup failed', e);
    } finally {
      this.isBackingUp.set(false);
    }
  }

  async restoreBackup(fileId: string) {
    if (this.isRestoring()) return;
    // Confirm? (Skip for prototype)
    this.isRestoring.set(true);
    try {
      await this.cloudService.restoreFromCloud('google', fileId);
      // Data signals (contacts$) update automatically via liveQuery
    } catch (e) {
      console.error('Restore failed', e);
    } finally {
      this.isRestoring.set(false);
    }
  }
}
