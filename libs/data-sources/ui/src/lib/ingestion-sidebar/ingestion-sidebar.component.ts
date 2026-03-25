import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';

@Component({
  selector: 'ingestion-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './ingestion-sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngestionSidebarComponent {
  state = inject(DataSourcesService);

  repoSummaries = computed(() => {
    const groups = this.state.groupedTargets();
    return Object.keys(groups).map((repo) => {
      const targets = [...groups[repo]];
      targets.sort((a, b) =>
        (b.lastSyncedAt || '').localeCompare(a.lastSyncedAt || ''),
      );
      const primary = targets[0];

      return {
        repo,
        primaryTargetId: primary.id.toString(),
        primaryBranch: primary.branch,
        branchCount: targets.length,
        status: primary.status,
      };
    });
  });
}
