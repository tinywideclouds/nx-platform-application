import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { PushNotificationService } from '@nx-platform-application/messenger-device-notifications';

@Component({
  selector: 'messenger-notification-permission-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    @if (showButton()) {
      <button mat-raised-button color="primary" (click)="request()">
        Enable Notifications
      </button>
    } @else if (status() === 'denied') {
      <p class="error-text">
        Notifications are blocked. Please enable them in browser settings.
      </p>
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

  // Expose signal for template
  status = this.pushService.permissionStatus;

  // Computed: Only show button if permission is 'default' (not yet asked)
  showButton = computed(() => this.status() === 'default');

  request() {
    // This MUST be triggered by a user gesture
    this.pushService.requestSubscription();
  }
}
