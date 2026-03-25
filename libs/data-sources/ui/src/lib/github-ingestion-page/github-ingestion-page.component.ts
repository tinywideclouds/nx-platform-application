import {
  Component,
  inject,
  computed,
  signal,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';

import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { URN } from '@nx-platform-application/platform-types';
import {
  FilterRules,
  RemoteTrackingState,
} from '@nx-platform-application/data-sources-types';

import {
  GithubIngestionFormComponent,
  GithubIngestionFormPayload,
} from '../github-ingestion-form/github-ingestion-form.component';
import { GithubIngestionHeaderComponent } from '../github-ingestion-header/github-ingestion-header.component';
import { VisualTreeFilterComponent } from '../visual-tree-filter/visual-tree-filter.component';
import { FileAnalysisSummaryComponent } from '../file-analysis-summary/file-analysis-summary.component';

@Component({
  selector: 'github-ingestion-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    GithubIngestionFormComponent,
    GithubIngestionHeaderComponent,
    VisualTreeFilterComponent,
    FileAnalysisSummaryComponent,
  ],
  templateUrl: './github-ingestion-page.component.html',
  styleUrl: './github-ingestion-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GithubIngestionPageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  state = inject(DataSourcesService);

  @ViewChild(GithubIngestionFormComponent)
  formComponent!: GithubIngestionFormComponent;

  id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))));
  isNew = computed(() => !this.id() || this.id() === 'new');

  formErrorCount = signal<number>(0);

  // Tracking Update UI State
  isCheckingRemote = signal<boolean>(false);
  isUpdatingTracking = signal<boolean>(false);
  pendingRemoteState = signal<RemoteTrackingState | null>(null);

  availableBranches = computed(() => {
    const activeRepo = this.state.activeTarget()?.repo;
    if (!activeRepo) return [];
    return this.state.groupedTargets()[activeRepo] || [];
  });

  visualRules = signal<FilterRules>({ include: ['**/*'], exclude: [] });
  manualIncludes = signal<string>('');
  manualExcludes = signal<string>('');

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const routeId = params.get('id');
      this.pendingRemoteState.set(null); // Reset pending updates on navigation
      if (!routeId || routeId === 'new') {
        this.state.clearSelection();
      } else {
        try {
          this.state.selectTarget(URN.parse(routeId));
        } catch (e) {
          this.router.navigate(['/data-sources/repos']);
        }
      }
    });
  }

  triggerFormSave() {
    if (this.formComponent) this.formComponent.triggerSave();
  }

  async onSaveGithubTarget(payload: GithubIngestionFormPayload) {
    if (!payload.repo || !payload.branch) return;

    const newTargetId = await this.state.createGithubTarget({
      repo: payload.repo,
      branch: payload.branch,
    });

    if (newTargetId) {
      this.router.navigate(['/data-sources/repos', newTargetId.toString()]);
    }
  }

  async onBranchChange(value: string) {
    if (value === 'NEW') {
      const repo = this.state.activeTarget()?.repo;
      if (!repo) return;
      const newBranch = prompt(
        `Enter new branch name to track for ${repo}:`,
        'main',
      );
      if (newBranch) {
        const newTargetId = await this.state.createGithubTarget({
          repo,
          branch: newBranch,
        });
        if (newTargetId)
          this.router.navigate(['/data-sources/repos', newTargetId.toString()]);
      }
    } else if (value) {
      this.router.navigate(['/data-sources/repos', value]);
    }
  }

  onCancel() {
    this.router.navigate(['/data-sources/repos']);
  }

  async onCheckForUpdates() {
    const targetId = this.state.activeTargetId();
    const currentTarget = this.state.activeTarget();
    if (!targetId || !currentTarget) return;

    this.isCheckingRemote.set(true);
    try {
      const remoteState = await this.state.checkRemoteTrackingState(targetId);
      if (remoteState) {
        if (remoteState.commitSha !== currentTarget.commitSha) {
          this.pendingRemoteState.set(remoteState); // Trigger comparison UI
        } else {
          this.snackBar.open('Tracking is up to date with GitHub.', 'Close', {
            duration: 3000,
          });
          this.pendingRemoteState.set(null);
        }
      }
    } finally {
      this.isCheckingRemote.set(false);
    }
  }

  async onUpdateTrackingState() {
    const targetId = this.state.activeTargetId();
    const pending = this.pendingRemoteState();
    if (!targetId || !pending) return;

    this.isUpdatingTracking.set(true);
    try {
      const success = await this.state.updateTrackingState(
        targetId,
        pending.commitSha,
      );
      if (success) {
        this.pendingRemoteState.set(null); // Close comparison UI on success
      }
    } finally {
      this.isUpdatingTracking.set(false);
    }
  }

  async onExecuteSync() {
    const targetId = this.state.activeTargetId();
    if (!targetId) return;

    const parseGlobs = (str: string) =>
      str
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const vRules = this.visualRules();
    const mIncludes = parseGlobs(this.manualIncludes());
    const mExcludes = parseGlobs(this.manualExcludes());

    const combinedIncludes = Array.from(
      new Set([...vRules.include, ...mIncludes]),
    );
    const combinedExcludes = Array.from(
      new Set([...vRules.exclude, ...mExcludes]),
    );

    const finalRules: FilterRules = {
      include: combinedIncludes.length ? combinedIncludes : ['**/*'],
      exclude: combinedExcludes,
    };

    try {
      await this.state.executeSync(targetId, finalRules);
    } catch (e) {
      // Handled by state service snackbar
    }
  }
}
