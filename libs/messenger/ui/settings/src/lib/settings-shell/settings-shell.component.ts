import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  effect,
} from '@angular/core';
import {
  Router,
  RouterOutlet,
  ActivatedRoute,
  NavigationEnd,
} from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';
import { SettingsSidebarComponent } from '../settings-sidebar/settings-sidebar.component';

@Component({
  selector: 'lib-settings-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MasterDetailLayoutComponent,
    SettingsSidebarComponent,
  ],
  templateUrl: './settings-shell.component.html',
  styleUrl: './settings-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsShellComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private breakpoints = inject(BreakpointObserver);

  // --- Reactive State ---

  // 1. Screen Size: True if handset/mobile
  isMobile = toSignal(
    this.breakpoints
      .observe([Breakpoints.Handset, Breakpoints.Small])
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // 2. Route State: Get the title of the child route
  activePageTitle = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.getChildRouteTitle(this.route)),
      startWith(this.getChildRouteTitle(this.route)),
    ),
    { initialValue: '' },
  );

  // 3. Detail View Visibility
  // On Mobile: Only show detail if we have a sub-route active (Title is present).
  // On Desktop: Always show detail (true).
  showDetail = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => !this.isMobile() || !!this.getChildRouteTitle(this.route)),
      startWith(!this.isMobile() || !!this.getChildRouteTitle(this.route)),
    ),
    { initialValue: true },
  );

  constructor() {
    // Desktop Auto-Nav Effect
    // If we are on Desktop AND at the root ('/settings'), automatically go to 'identity'
    effect(() => {
      const mobile = this.isMobile();
      const title = this.activePageTitle();

      if (!mobile && !title) {
        this.router.navigate(['identity'], {
          relativeTo: this.route,
          replaceUrl: true,
        });
      }
    });
  }

  // --- Actions ---

  onCloseSidebar() {
    // "Close" from the sidebar means exit settings entirely
    this.router.navigate(['/messenger']);
  }

  onMobileBack() {
    // "Back" from the detail view means go up to settings root (Sidebar)
    this.router.navigate(['/messenger/settings']);
  }

  // --- Helpers ---

  private getChildRouteTitle(route: ActivatedRoute): string {
    let child = route.firstChild;
    while (child) {
      if (child.snapshot.data['title']) {
        return child.snapshot.data['title'];
      }
      child = child.firstChild;
    }
    return '';
  }
}
