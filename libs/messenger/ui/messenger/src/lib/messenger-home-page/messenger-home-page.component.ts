import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';

import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

// LAYOUT
import {
  MessengerToolbarComponent,
  SidebarView,
} from '../messenger-toolbar/messenger-toolbar.component';
import { LogoutDialogComponent } from '../logout-dialog/logout-dialog.component';
import { DeviceLinkWizardComponent } from '../device-link-wizard/device-link-wizard.component';

// SERVICES
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';

@Component({
  selector: 'messenger-home-page',
  standalone: true,
  imports: [
    RouterOutlet,
    MatDialogModule,
    MessengerToolbarComponent,
    DeviceLinkWizardComponent,
  ],
  templateUrl: './messenger-home-page.component.html',
  styleUrl: './messenger-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerHomePageComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private authService = inject(IAuthService);
  private chatService = inject(ChatService);

  // --- STATE ---
  currentUser = this.authService.currentUser;

  // ✅ New: Halt State Check
  // If true, the Wizard Overlay renders and blocks interaction.
  showDeviceLinkWizard = computed(
    () => this.chatService.onboardingState() === 'REQUIRES_LINKING',
  );

  /**
   * Derives the active sidebar state strictly from the URL.
   * Now only tracks 'conversations' vs 'contacts'.
   */
  activeView = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.getSidebarViewFromUrl(this.router.url)),
      startWith(this.getSidebarViewFromUrl(this.router.url)),
    ),
    { initialValue: 'conversations' as SidebarView },
  );

  // --- ACTIONS ---

  onViewConversations() {
    this.router.navigate(['/messenger', 'conversations']);
  }

  onViewContacts() {
    this.router.navigate(['/messenger', 'contacts']);
  }

  onViewSettings() {
    this.router.navigate(['/messenger', 'settings']);
  }

  onLogout() {
    this.dialog
      .open(LogoutDialogComponent)
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.authService.logout().subscribe({
            next: () => this.router.navigate(['/login']),
            error: () => this.router.navigate(['/login']),
          });
        }
      });
  }

  // --- HELPERS ---

  private getSidebarViewFromUrl(url: string): SidebarView {
    if (url.includes('/contacts')) return 'contacts';
    return 'conversations';
  }
}
