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

// ✅ STATE LAYERS (Infrastructure Removed)
import { AppState } from '@nx-platform-application/messenger-state-app';
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';

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

  // ✅ Facades
  private appState = inject(AppState);
  private identity = inject(ChatIdentityFacade);

  // --- STATE ---
  // Proxy via Identity Facade
  currentUser = this.identity.currentUser;

  // Halt State Check (Driven by Identity State)
  showDeviceLinkWizard = computed(
    () => this.identity.onboardingState() === 'REQUIRES_LINKING',
  );

  /**
   * Derives the active sidebar state strictly from the URL.
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
      .subscribe(async (confirmed) => {
        if (confirmed) {
          try {
            // ✅ Global Session Teardown (AppState)
            await this.appState.sessionLogout();
          } catch (e) {
            console.error('Logout failed', e);
          } finally {
            this.router.navigate(['/login']);
          }
        }
      });
  }

  // --- HELPERS ---

  private getSidebarViewFromUrl(url: string): SidebarView {
    if (url.includes('/contacts')) return 'contacts';
    return 'conversations';
  }
}
