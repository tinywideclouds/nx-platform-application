import { Component, inject, signal } from '@angular/core'; // ✅ Import signal
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PushNotificationService } from '@nx-platform-application/messenger-device-notifications';

@Component({
  selector: 'messenger-notification-permission-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatSnackBarModule],
  template: `
    @if (status() === 'denied') {
      <p class="error-text">
        Notifications are blocked. Please enable them in browser settings.
      </p>
    } @else {
      <button
        mat-flat-button
        [color]="isSubscribed() ? 'warn' : 'primary'"
        [disabled]="loading()"
        (click)="toggle()"
      >
        @if (loading()) {
          Processing...
        } @else if (isSubscribed()) {
          Disable Notifications
        } @else {
          Enable Notifications
        }
      </button>
    }
  `,
  styles: [
    `
      .error-text {
        color: red;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class NotificationPermissionButtonComponent {
  private pushService = inject(PushNotificationService);
  private snackBar = inject(MatSnackBar);

  status = this.pushService.permissionStatus;
  isSubscribed = this.pushService.isSubscribed;

  // ✅ Signal ensures the template updates when this changes
  loading = signal(false);

  async toggle() {
    this.loading.set(true); // Lock

    try {
      if (this.isSubscribed()) {
        await this.pushService.disableNotifications();
        this.snackBar.open('Notifications disabled.', 'OK', { duration: 3000 });
      } else {
        await this.pushService.requestSubscription();
        this.snackBar.open('Notifications enabled!', 'OK', { duration: 3000 });
      }
    } catch (e) {
      console.error(e);
      this.snackBar.open('Action failed.', 'Close', { duration: 3000 });
    } finally {
      this.loading.set(false); // ✅ Unlock (Now guaranteed to refresh UI)
    }
  }
}
