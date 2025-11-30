import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import {
  ContactsCloudService,
  CloudBackupMetadata,
} from '@nx-platform-application/contacts-cloud-access';

// ✅ Import the new sub-component
import { ContactsSecurityComponent } from '../contacts-security/contacts-security.component';

@Component({
  selector: 'contacts-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressBarModule,
    ContactsSecurityComponent, // ✅ Use the sub-component
  ],
  templateUrl: './contacts-settings-page.component.html',
  styleUrl: './contacts-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsSettingsPageComponent {
  private cloudService = inject(ContactsCloudService);

  // --- CLOUD STATE (Kept here for Contacts App) ---
  isBackingUp = signal(false);
  isRestoring = signal(false);
  cloudBackups = signal<CloudBackupMetadata[]>([]);

  constructor() {
    if (this.cloudService.hasPermission('google')) {
      this.refreshBackups();
    }
  }

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
