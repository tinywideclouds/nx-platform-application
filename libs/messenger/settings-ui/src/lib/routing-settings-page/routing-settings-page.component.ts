// libs/messenger/settings-ui/src/lib/routing-settings-page/routing-settings-page.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';
// IMPORT KeyCacheService
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { NotificationPermissionButtonComponent } from '../notification-permission-button/notification-permission-button';

@Component({
  selector: 'lib-routing-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatSnackBarModule,
    NotificationPermissionButtonComponent,
  ],
  templateUrl: './routing-settings-page.component.html',
  styleUrl: './routing-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutingSettingsPageComponent {
  private chatService = inject(ChatService);
  private keyCache = inject(KeyCacheService); // <--- INJECTED
  private logger = inject(Logger);
  private snackBar = inject(MatSnackBar);

  connectionStatus = signal<'connected' | 'disconnected' | 'connecting'>(
    'connected',
  );
  messageCount = this.chatService.messages;

  // --- NEW METHOD ---
  async onClearKeyCache(): Promise<void> {
    try {
      await this.keyCache.clear();
      this.logger.info('User manually cleared Public Key Cache.');
      this.snackBar.open(
        'Public Key Cache cleared. Keys will be re-fetched on next send.',
        'OK',
        {
          duration: 3000,
        },
      );
    } catch (e) {
      this.logger.error('Failed to clear key cache', e);
      this.snackBar.open('Failed to clear cache.', 'Dismiss', {
        duration: 3000,
      });
    }
  }

  onClearHistory(): void {
    if (confirm('Delete all message history?')) {
      this.logger.warn('Clear History requested but not implemented.');
      this.snackBar.open(
        'This feature requires an update to ChatService.',
        'Got it',
        { duration: 3000 },
      );
    }
  }

  onForceReconnect(): void {
    this.logger.warn('Reconnect requested but not implemented.');
    this.snackBar.open('Feature pending.', 'Got it', { duration: 3000 });
  }
}
