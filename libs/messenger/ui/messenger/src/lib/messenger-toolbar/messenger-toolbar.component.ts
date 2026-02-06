import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  User,
  ConnectionStatus,
} from '@nx-platform-application/platform-types';
import { toSignal } from '@angular/core/rxjs-interop';

import { MessengerNetworkStatusComponent } from '../messenger-network-status/messenger-network-status.component';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

// ✅ NEW: Direct Domain Injection
import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';

export type SidebarView = 'conversations' | 'contacts';

@Component({
  selector: 'messenger-toolbar',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule,
    MessengerNetworkStatusComponent,
  ],
  templateUrl: './messenger-toolbar.component.html',
  styleUrl: './messenger-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerToolbarComponent {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  private chatData = inject(ChatDataService);

  // ✅ Cloud Service for Sync Status
  private syncService = inject(CloudSyncService);

  // --- Inputs / Outputs ---
  currentUser = input.required<User | null>();
  activeView = input<SidebarView>('conversations');

  viewConversations = output<void>();
  viewContacts = output<void>();
  viewSettings = output<void>();
  logout = output<void>();

  // --- Raw Signals ---
  private networkRaw = toSignal(this.chatData.liveConnection, {
    initialValue: 'disconnected',
  });

  private isBackingUp = this.syncService.isSyncing;
  private isCloudAuthRequired = this.syncService.requiresUserInteraction;
  private isCloudEnabled = this.syncService.isConnected;

  constructor() {
    // Effect: One-time Snackbar Alert
    effect(() => {
      if (this.isCloudAuthRequired()) {
        this.snackBar
          .open('Cloud Sync Paused: Sign in to resume', 'SIGN IN', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
          })
          .onAction()
          .subscribe(() => {
            this.syncService.connect('google-drive');
          });
      }
    });
  }

  // --- Priority Logic ---
  connectionStatus = computed<ConnectionStatus | 'attention'>(() => {
    const rawState = this.networkRaw();

    // 1. WebSocket Offline takes precedence
    if (rawState !== 'connected') {
      return rawState as ConnectionStatus;
    }

    // 2. Cloud Auth Issue (Subtle Warning)
    if (this.isCloudAuthRequired()) {
      return 'attention';
    }

    // 3. Active Syncing
    if (this.isBackingUp()) {
      return 'syncing';
    }

    // 4. Healthy
    return 'connected';
  });

  // --- Tooltip ---
  statusTooltip = computed(() => {
    const state = this.connectionStatus();

    switch (state) {
      case 'disconnected':
      case 'offline':
        return 'Offline - Check Connection';
      case 'reconnection':
        return 'Reconnecting...';
      case 'connecting':
        return 'Connecting...';
      case 'attention':
        return 'Action Required: Click to Sign In';
      case 'syncing':
        return 'Syncing to Cloud...';
      case 'connected':
        return this.isCloudEnabled()
          ? 'Online • Cloud Backup Active'
          : 'Online • Cloud Backup Disabled';
      default:
        return 'Unknown State';
    }
  });

  get initials(): string {
    const user = this.currentUser();
    if (!user || !user.alias) return '?';
    return user.alias.slice(0, 2).toUpperCase();
  }

  // Action Handler
  handleNetworkAction() {
    if (this.isCloudAuthRequired()) {
      this.syncService.connect('google-drive');
    } else {
      this.router.navigate(['/messenger', 'settings', 'identity']);
    }
  }
}
