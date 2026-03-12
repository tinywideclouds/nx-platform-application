import {
  Component,
  inject,
  computed,
  signal,
  OnInit,
  effect,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { URN } from '@nx-platform-application/platform-types';

export interface ContextPickerResult {
  type: 'source' | 'group';
  id: URN;
  name: string;
}

@Component({
  selector: 'data-sources-context-picker',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
  ],
  templateUrl: './context-picker-dialog.component.html',
  styleUrl: './context-picker-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextPickerDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<ContextPickerDialogComponent>);
  private router = inject(Router);
  state = inject(DataSourcesService);

  selection = signal<ContextPickerResult | null>(null);
  selectedTabIndex = signal(0);

  private hasSetInitialTab = false;

  repoSummaries = computed(() => {
    const groups = this.state.groupedDataSources();
    return Object.keys(groups).map((repo) => {
      const bundles = [...groups[repo]];
      bundles.sort((a, b) => b.lastSyncedAt - a.lastSyncedAt);
      const primary = bundles[0];

      return {
        repo,
        primaryDataSourceId: primary.id,
        primaryBranch: primary.branch,
        status: primary.status,
      };
    });
  });

  constructor() {
    // Smart default: If data finishes loading and there are no groups, flip to the Repos tab
    effect(() => {
      const groupsLoading = this.state.isDataGroupsLoading();
      const groups = this.state.dataGroups();

      if (!groupsLoading && !this.hasSetInitialTab) {
        untracked(() => {
          if (groups.length === 0) {
            this.selectedTabIndex.set(1);
          }
          this.hasSetInitialTab = true;
        });
      }
    });
  }

  ngOnInit() {
    this.state.loadAllDataSources();
    this.state.loadAllDataGroups();
  }

  selectGroup(id: URN, name: string) {
    this.selection.set({ type: 'group', id, name });
  }

  selectSource(id: URN, name: string) {
    this.selection.set({ type: 'source', id, name });
  }

  onAttach() {
    const current = this.selection();
    if (current) {
      this.dialogRef.close(current);
    }
  }

  onCancel() {
    this.dialogRef.close(null);
  }

  goToDatasourceSetup() {
    this.dialogRef.close(null);
    this.router.navigate(['/data-sources/repos/new']);
  }

  goToGroupSetup() {
    this.dialogRef.close(null);
    this.router.navigate(['/data-sources/groups/new']);
  }
}
