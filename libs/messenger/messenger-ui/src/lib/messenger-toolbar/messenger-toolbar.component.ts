import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
} from '@angular/core';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  User,
  ConnectionStatus, // ✅ The new type
} from '@nx-platform-application/platform-types';
import { toSignal } from '@angular/core/rxjs-interop';

// IMPORT NETWORK STATUS
import { MessengerNetworkStatusComponent } from '../messenger-network-status/messenger-network-status.component';
// IMPORT SERVICES
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';

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
    MessengerNetworkStatusComponent,
  ],
  templateUrl: './messenger-toolbar.component.html',
  styleUrl: './messenger-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerToolbarComponent {
  private liveService = inject(ChatLiveDataService);
  private cloudService = inject(ChatCloudService);

  // --- Inputs / Outputs ---
  currentUser = input.required<User | null>();
  activeView = input<SidebarView>('conversations');

  viewConversations = output<void>();
  viewContacts = output<void>();
  viewSettings = output<void>();
  logout = output<void>();

  // --- Raw Signals ---
  // The service might emit strings like 'disconnected', 'reconnecting', etc.
  private networkRaw = toSignal(this.liveService.status$, {
    initialValue: 'disconnected',
  });

  private isBackingUp = this.cloudService.isBackingUp;
  private isCloudEnabled = this.cloudService.isCloudEnabled;

  // --- Priority Logic ---
  connectionStatus = computed<ConnectionStatus>(() => {
    const rawState = this.networkRaw();

    // 1. Priority: Network Instability
    // If we aren't fully connected (e.g. offline, error, connecting),
    // that is the most important thing to show.
    if (rawState !== 'connected') {
      return rawState;
    }

    // 2. Priority: Syncing
    // We are connected, but perform data operations.
    if (this.isBackingUp()) {
      return 'syncing';
    }

    // 3. Priority: Idle & Healthy
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
}
