import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

export type DataSourceActiveView = 'repos' | 'groups';

@Component({
  selector: 'data-sources-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './data-sources-sidebar.component.html',
})
export class DataSourcesSidebarComponent {
  state = inject(DataSourcesService);
  private router = inject(Router);

  activeView = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(
        () =>
          (this.router.url.includes('/groups')
            ? 'groups'
            : 'repos') as DataSourceActiveView,
      ),
      startWith(
        (this.router.url.includes('/groups')
          ? 'groups'
          : 'repos') as DataSourceActiveView,
      ),
    ),
    { initialValue: 'repos' as DataSourceActiveView },
  );

  repoSummaries = computed(() => {
    // Calling the newly renamed computed signal on our state service
    const groups = this.state.groupedTargets();
    return Object.keys(groups).map((repo) => {
      const targets = [...groups[repo]];
      targets.sort((a, b) => b.lastSyncedAt - a.lastSyncedAt);
      const primary = targets[0];

      return {
        repo,
        primaryTargetId: primary.id.toString(), // Updated property name
        primaryBranch: primary.branch,
        branchCount: targets.length,
        lastSyncedAt: primary.lastSyncedAt,
        status: primary.status,
      };
    });
  });

  constructor() {
    this.state.loadAllTargets(); // Updated method name
    this.state.loadAllDataGroups();
  }

  switchView(view: DataSourceActiveView) {
    if (view === 'repos') {
      this.router.navigate(['/data-sources/repos']);
    } else {
      this.router.navigate(['/data-sources/groups']);
    }
  }
}
