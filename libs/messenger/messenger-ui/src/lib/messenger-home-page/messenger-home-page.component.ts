import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
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

// SERVICES
import { IAuthService } from '@nx-platform-application/platform-auth-access';

@Component({
  selector: 'messenger-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatDialogModule,
    MessengerToolbarComponent,
  ],
  templateUrl: './messenger-home-page.component.html',
  styleUrl: './messenger-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerHomePageComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private authService = inject(IAuthService);

  // --- STATE ---
  currentUser = this.authService.currentUser;

  /**
   * Derives the active sidebar state strictly from the URL.
   * Now only tracks 'conversations' vs 'contacts'.
   */
  activeView = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.getSidebarViewFromUrl(this.router.url)),
      startWith(this.getSidebarViewFromUrl(this.router.url))
    ),
    { initialValue: 'conversations' as SidebarView }
  );

  // --- ACTIONS ---

  onViewConversations() {
    // We navigate to the root conversations route.
    // This will naturally show the list, or the last active child route.
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
          this.authService.logout();
        }
      });
  }

  // --- HELPERS ---

  private getSidebarViewFromUrl(url: string): SidebarView {
    if (url.includes('/contacts')) return 'contacts';
    // 'compose' is no longer a top-level view, it lives inside conversations
    return 'conversations';
  }
}
