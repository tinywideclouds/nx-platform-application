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

import { AppState } from '@nx-platform-application/messenger-state-app';

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
  private liveService = inject(ChatLiveDataService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  // ✅ 2. Inject Facade
  private appState = inject(AppState);

  // --- Inputs / Outputs ---
  currentUser = input.required<User | null>();
  activeView = input<SidebarView>('conversations');

  viewConversations = output<void>();
  viewContacts = output<void>();
  viewSettings = output<void>();
  logout = output<void>();

  // --- Raw Signals ---
  private networkRaw = toSignal(this.liveService.status$, {
    initialValue: 'disconnected',
  });

  // ✅ 3. Use Facade Signals
  private isBackingUp = this.appState.isBackingUp;
  private isCloudAuthRequired = this.appState.isCloudAuthRequired; // New signal

  // Since isCloudEnabled is a getter on the service, we compute it once or wrap it.
  private isCloudEnabled = computed(() => this.appState.isCloudConnected());

  constructor() {
    // ✅ Effect: One-time Snackbar Alert
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
            this.appState.connectCloud();
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

  // ✅ Action Handler
  handleNetworkAction() {
    if (this.isCloudAuthRequired()) {
      this.appState.connectCloud();
    } else {
      this.router.navigate(['/messenger', 'settings', 'identity']);
    }
  }
}
