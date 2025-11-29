import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';

import {
  ContactsStorageService,
  PendingIdentity,
} from '@nx-platform-application/contacts-storage';
import {
  ContactsCloudService,
  CloudBackupMetadata,
} from '@nx-platform-application/contacts-cloud-access';

import { PendingListComponent } from '../pending-list/pending-list.component';

@Component({
  selector: 'contacts-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatCardModule,
    MatProgressBarModule,
    MatExpansionModule,
    PendingListComponent,
  ],
  templateUrl: './contacts-settings-page.component.html',
  styleUrl: './contacts-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsSettingsPageComponent {
  private contactsService = inject(ContactsStorageService);
  private cloudService = inject(ContactsCloudService);

  // --- DATA SIGNALS ---
  pending = toSignal(this.contactsService.pending$, { initialValue: [] });

  // --- CLOUD STATE ---
  isBackingUp = signal(false);
  isRestoring = signal(false);
  cloudBackups = signal<CloudBackupMetadata[]>([]);

  constructor() {
    if (this.cloudService.hasPermission('google')) {
      this.refreshBackups();
    }
  }

  // --- ACTIONS: GATEKEEPER ---

  async approveIdentity(pending: PendingIdentity) {
    await this.contactsService.deletePending(pending.urn);
  }

  async blockPending(pending: PendingIdentity) {
    await this.contactsService.blockIdentity(pending.urn, 'Blocked');
    await this.contactsService.deletePending(pending.urn);
  }

  // --- ACTIONS: CLOUD ---

  async refreshBackups() {
    try {
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
    this.isRestoring.set(true);
    try {
      await this.cloudService.restoreFromCloud('google', fileId);
    } catch (e) {
      console.error('Restore failed', e);
    } finally {
      this.isRestoring.set(false);
    }
  }
}
