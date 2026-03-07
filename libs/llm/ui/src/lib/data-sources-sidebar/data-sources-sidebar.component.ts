import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LlmDataSourcesStateService } from '@nx-platform-application/llm-features-data-sources';

@Component({
  selector: 'llm-data-sources-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './data-sources-sidebar.component.html',
})
export class LlmDataSourcesSidebarComponent {
  state = inject(LlmDataSourcesStateService);

  // Transforms the grouped dictionary into an array sorted for the UI
  repoSummaries = computed(() => {
    const groups = this.state.groupedCaches();

    return Object.keys(groups).map((repo) => {
      // Copy the array before sorting to avoid mutating the signal's internal state
      const bundles = [...groups[repo]];

      // Sort so the most recently synced branch is always the primary destination
      bundles.sort((a, b) => b.lastSyncedAt - a.lastSyncedAt);
      const primary = bundles[0];

      return {
        repo,
        primaryCacheId: primary.id.toString(),
        primaryBranch: primary.branch,
        branchCount: bundles.length,
        lastSyncedAt: primary.lastSyncedAt,
        status: primary.status,
      };
    });
  });

  constructor() {
    // Dispatch initial load immediately upon instantiation
    this.state.loadAllCaches();
  }
}
