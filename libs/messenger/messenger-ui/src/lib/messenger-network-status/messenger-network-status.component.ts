// libs/messenger/messenger-ui/src/lib/messenger-network-status/messenger-network-status.component.ts

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';

import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';

@Component({
  selector: 'messenger-network-status',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <div
      class="flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200 cursor-pointer hover:bg-gray-100"
      [class.bg-blue-50]="isOnline()"
      [matTooltip]="getTooltip()"
      (click)="navigateToSettings()"
    >
      @if (isSyncing()) {
      <mat-icon
        class="text-blue-600 text-sm !w-5 !h-5 !text-[20px] animate-spin"
        >sync</mat-icon
      >
      } @else if (isOnline()) {
      <mat-icon class="text-green-600 text-sm !w-5 !h-5 !text-[20px]"
        >wifi</mat-icon
      >
      } @else {
      <mat-icon class="text-gray-400 text-sm !w-5 !h-5 !text-[20px]"
        >wifi_off</mat-icon
      >
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerNetworkStatusComponent {
  private cloud = inject(ChatCloudService);
  private router = inject(Router);

  isOnline = this.cloud.isCloudEnabled;
  isSyncing = this.cloud.isBackingUp;

  getTooltip(): string {
    if (this.isSyncing()) return 'Syncing messages...';
    if (this.isOnline()) return 'Cloud Backup Active';
    return 'Offline (Click to Connect)';
  }

  navigateToSettings(): void {
    // Navigate to the Identity settings page where the toggle lives
    this.router.navigate(['/messenger', 'settings', 'identity']);
  }
}
