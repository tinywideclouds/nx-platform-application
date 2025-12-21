import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConnectionStatus } from '@nx-platform-application/platform-types';

@Component({
  selector: 'messenger-network-status',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <div
      class="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 cursor-pointer hover:bg-gray-100"
      [class.bg-green-50]="status() === 'connected'"
      [class.bg-blue-50]="status() === 'syncing'"
      [class.bg-yellow-50]="
        status() === 'connecting' || status() === 'reconnection'
      "
      [class.bg-red-50]="
        status() === 'disconnected' ||
        status() === 'offline' ||
        status() === 'error'
      "
      [matTooltip]="tooltipText()"
      (click)="navigateToSettings()"
    >
      @switch (status()) {
        @case ('syncing') {
          <mat-icon
            class="text-blue-600 !text-[18px] !w-[18px] !h-[18px] animate-spin"
          >
            sync
          </mat-icon>
        }

        @case ('connected') {
          <mat-icon class="text-green-600 !text-[18px] !w-[18px] !h-[18px]">
            wifi
          </mat-icon>
        }

        @case ('connecting') {
          <mat-icon
            class="text-yellow-600 !text-[18px] !w-[18px] !h-[18px] animate-pulse"
          >
            wifi_tethering
          </mat-icon>
        }

        @case ('reconnection') {
          <mat-icon
            class="text-yellow-600 !text-[18px] !w-[18px] !h-[18px] animate-pulse"
          >
            wifi_tethering
          </mat-icon>
        }

        @default {
          <mat-icon class="text-red-400 !text-[18px] !w-[18px] !h-[18px]">
            wifi_off
          </mat-icon>
        }
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
  private router = inject(Router);

  // ✅ Typed Input: Receives the computed priority state from Toolbar
  status = input.required<ConnectionStatus>();

  // ✅ Tooltip Text: Computed by the parent to include Cloud details
  tooltipText = input<string>('');

  navigateToSettings(): void {
    this.router.navigate(['/messenger', 'settings', 'identity']);
  }
}
