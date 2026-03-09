import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

// MATERIAL
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

// UI LAYOUT
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';

// FEATURE COMPONENTS
import { DataSourcesSidebarComponent } from '../data-sources-sidebar/data-sources-sidebar.component';

@Component({
  selector: 'data-sources-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MasterDetailLayoutComponent,
    DataSourcesSidebarComponent,
  ],
  templateUrl: './data-sources-layout.component.html',
  styleUrl: './data-sources-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourcesLayoutComponent {
  private router = inject(Router);

  // Tracks if the layout is currently collapsed into a single column (Mobile mode)
  isMobile = signal<boolean>(false);

  // Monitor the router to determine if we are looking at a detail page or just the root list.
  // This drives the `showDetail` flag on the master-detail component.
  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
  );

  // True if the URL contains something after '/data-sources/' (e.g., 'new' or an ID)
  showDetail = computed(() => {
    const url = this.currentUrl();
    if (!url) return false;

    // Split by ? to ignore query params, then check path depth
    const path = url.split('?')[0];
    return path !== '/data-sources' && path !== '/data-sources/';
  });

  isNew = computed(() => {
    return this.currentUrl()?.includes('/data-sources/new') ?? false;
  });

  // Action for the mobile back button
  goBackToList() {
    this.router.navigate(['/data-sources']);
  }
}
