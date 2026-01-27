import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

// ✅ UPDATE: Use the new Sync Service (Snapshot API)
import { ContactsSyncService } from '@nx-platform-application/contacts-domain-sync';

@Component({
  selector: 'contacts-settings-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressBarModule,
  ],
  templateUrl: './contacts-settings-page.component.html',
  styleUrl: './contacts-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsSettingsPageComponent {
  private syncService = inject(ContactsSyncService);
  private snackBar = inject(MatSnackBar);

  // --- CLOUD STATE ---
  isBusy = signal(false);

  async backupToCloud() {
    if (this.isBusy()) return;
    this.isBusy.set(true);

    try {
      await this.syncService.backup();
      this.showSnack('Backup successful');
    } catch (e) {
      console.error('Backup failed', e);
      this.showSnack('Backup failed', true);
    } finally {
      this.isBusy.set(false);
    }
  }

  async restoreFromCloud() {
    if (this.isBusy()) return;
    if (
      !confirm(
        'This will merge cloud contacts into your local device. Continue?',
      )
    )
      return;

    this.isBusy.set(true);
    try {
      await this.syncService.restore();
      this.showSnack('Restore complete');
    } catch (e) {
      console.error('Restore failed', e);
      this.showSnack('Restore failed', true);
    } finally {
      this.isBusy.set(false);
    }
  }

  private showSnack(msg: string, isError = false) {
    this.snackBar.open(msg, 'Close', {
      duration: 3000,
      panelClass: isError ? 'warn-snack' : undefined,
    });
  }
}
