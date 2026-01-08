import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { Logger } from '@nx-platform-application/console-logger';

@Component({
  selector: 'platform-storage-settings-card',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './storage-settings-card.component.html',
  styleUrl: './storage-settings-card.component.scss',
})
export class StorageSettingsCardComponent {
  private storage = inject(StorageService);
  private logger = inject(Logger);
  private snackBar = inject(MatSnackBar);

  // State
  isConnected = this.storage.isConnected;
  activeId = this.storage.activeProviderId;
  isBusy = signal<boolean>(false);

  // The Menu
  options = this.storage.getAvailableOptions();

  // Computeds
  activeProviderName = computed(() => {
    const id = this.activeId();
    return this.options.find((o) => o.id === id)?.name || 'Unknown Provider';
  });

  statusText = computed(() => (this.isConnected() ? 'Active' : 'Offline'));

  statusClass = computed(() => {
    return this.isConnected() ? 'text-green-600' : 'text-gray-500';
  });

  async connect(id: string) {
    this.isBusy.set(true);

    try {
      const success = await this.storage.connect(id);
      if (success) {
        this.snackBar.open(`Connected to ${id}`, 'OK', { duration: 3000 });
      } else {
        this.snackBar.open('Connection cancelled or failed', 'Retry', {
          duration: 5000,
        });
      }
    } catch (e) {
      this.logger.error(`[StorageSettings] Connection to ${id} failed`, e);
      this.snackBar.open('Network error. Please try again.', 'Close', {
        duration: 5000,
      });
    } finally {
      this.isBusy.set(false);
    }
  }

  async disconnect() {
    // We can use a MatDialog here, but window.confirm is a safe fallback for pure logic tests
    if (!confirm('Are you sure? This will stop syncing your data.')) return;

    this.isBusy.set(true);
    try {
      await this.storage.disconnect();
      this.snackBar.open('Storage disconnected', 'OK', { duration: 3000 });
    } catch (e) {
      this.logger.error('[StorageSettings] Disconnect failed', e);
      this.snackBar.open('Failed to disconnect cleanly', 'Close', {
        duration: 5000,
      });
    } finally {
      this.isBusy.set(false);
    }
  }
}
