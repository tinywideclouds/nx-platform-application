// libs/messenger/settings-ui/src/lib/routing-settings-page/routing-settings-page.component.ts

import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // <--- NEW

import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';

@Component({
  selector: 'lib-routing-settings-page',
  standalone: true,
  imports: [
    CommonModule, 
    MatButtonModule, 
    MatCardModule, 
    MatIconModule,
    MatChipsModule,
    MatSnackBarModule
  ],
  templateUrl: './routing-settings-page.component.html',
  styleUrl: './routing-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutingSettingsPageComponent {
  private chatService = inject(ChatService);
  private logger = inject(Logger);
  private snackBar = inject(MatSnackBar); // <--- INJECTED

  connectionStatus = signal<'connected' | 'disconnected' | 'connecting'>('connected');
  messageCount = this.chatService.messages;

  onClearHistory(): void {
    // For simple "Not Implemented" checks, we can skip the dialog and just log/notify
    // Or add the dialog if we want to confirm the INTENT before failing.
    this.showPendingFeature('Clear History');
  }

  onForceReconnect(): void {
    this.showPendingFeature('Force Reconnect');
  }

  private showPendingFeature(name: string): void {
    this.logger.warn(`${name} requested but not implemented.`);
    
    // Non-blocking notification
    this.snackBar.open(`${name} will be available in a future update.`, 'Got it', {
      duration: 3000
    });
  }
}