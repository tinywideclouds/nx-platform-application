// libs/messenger/settings-ui/src/lib/identity-settings-page/identity-settings-page.component.ts

import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

// Services
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { ChatService } from '@nx-platform-application/chat-state';

// Dialog
import { SecureLogoutDialogComponent } from '../secure-logout-dialog/secure-logout-dialog.component';

@Component({
  selector: 'lib-identity-settings-page',
  standalone: true,
  imports: [
    CommonModule, 
    MatButtonModule, 
    MatCardModule, 
    MatIconModule,
    MatDialogModule,
    MatTooltipModule
  ],
  templateUrl: './identity-settings-page.component.html',
  styleUrl: './identity-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentitySettingsPageComponent {
  private authService = inject(IAuthService);
  private chatService = inject(ChatService);
  private dialog = inject(MatDialog);

  currentUser = this.authService.currentUser;

  // Compute initials for avatar fallback
  initials = computed(() => {
    const user = this.currentUser();
    if (!user || !user.alias) return '?';
    return user.alias.slice(0, 2).toUpperCase();
  });

  onSecureLogout(): void {
    this.dialog.open(SecureLogoutDialogComponent).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        // Calls the "Scorched Earth" logout from ChatService
        this.chatService.logout();
      }
    });
  }
}