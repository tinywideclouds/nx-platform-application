import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DataSourcesService } from '@nx-platform-application/data-sources/features/state';

@Component({
  selector: 'data-sources-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './data-sources-sidebar.component.html',
})
export class DataSourcesSidebarComponent {
  state = inject(DataSourcesService);

  // Transforms the grouped dictionary into an array sorted for the UI
  repoSummaries = computed(() => {
    const groups = this.state.groupedDataSources();

    return Object.keys(groups).map((repo) => {
      // Copy the array before sorting to avoid mutating the signal's internal state
      const bundles = [...groups[repo]];

      // Sort so the most recently synced branch is always the primary destination
      bundles.sort((a, b) => b.lastSyncedAt - a.lastSyncedAt);
      const primary = bundles[0];

      return {
        repo,
        primaryDataSourceId: primary.id.toString(),
        primaryBranch: primary.branch,
        branchCount: bundles.length,
        lastSyncedAt: primary.lastSyncedAt,
        status: primary.status,
      };
    });
  });

  constructor() {
    // Dispatch initial load immediately upon instantiation
    this.state.loadAllDataSources();
  }
}
