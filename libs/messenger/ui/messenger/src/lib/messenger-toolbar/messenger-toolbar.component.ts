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
  ConnectionStatus,
} from '@nx-platform-application/platform-types';
import { toSignal } from '@angular/core/rxjs-interop';

import { MessengerNetworkStatusComponent } from '../messenger-network-status/messenger-network-status.component';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

// ✅ 1. Import the Facade (State Layer), NOT the Domain or Deprecated Service
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';

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

  // ✅ 2. Inject Facade
  private chatService = inject(ChatService);

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
  private isBackingUp = this.chatService.isBackingUp;

  // Since isCloudEnabled is a getter on the service, we compute it once or wrap it.
  // Assuming configuration doesn't change runtime without reload, this is safe.
  private isCloudEnabled = computed(() => this.chatService.isCloudConnected);

  // --- Priority Logic ---
  connectionStatus = computed<ConnectionStatus>(() => {
    const rawState = this.networkRaw();

    if (rawState !== 'connected') {
      return rawState;
    }

    if (this.isBackingUp()) {
      return 'syncing';
    }

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
