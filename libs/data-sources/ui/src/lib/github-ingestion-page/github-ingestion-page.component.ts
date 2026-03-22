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
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';
import { URN } from '@nx-platform-application/platform-types';

// Child Components
import {
  GithubIngestionFormComponent,
  GithubIngestionFormPayload,
} from '../github-ingestion-form/github-ingestion-form.component';
import { GithubIngestionHeaderComponent } from '../github-ingestion-header/github-ingestion-header.component';
import { IngestionSourceAnalysisComponent } from '../ingestion-source-analysis/ingestion-source-analysis.component';
import {
  DataSourcesComponent,
  DataSourceSaveEvent,
} from '../data-source-page/data-source-page.component';

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
    IngestionSourceAnalysisComponent,
    DataSourcesComponent,
  ],
  templateUrl: './github-ingestion-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GithubIngestionPageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  state = inject(DataSourcesService);

  @ViewChild(GithubIngestionFormComponent)
  formComponent!: GithubIngestionFormComponent;

  @ViewChild(DataSourcesComponent)
  dataSourcesManager!: DataSourcesComponent;

  id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))));
  isNew = computed(() => !this.id() || this.id() === 'new');

  formErrorCount = signal<number>(0);

  ingestionIncludes = signal<string>('**/*');
  ingestionExcludes = signal<string>('node_modules/**, vendor/**, .git/**');

  availableBranches = computed(() => {
    const activeRepo = this.state.activeTarget()?.repo;
    if (!activeRepo) return [];
    return this.state.groupedTargets()[activeRepo] || [];
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const routeId = params.get('id');
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

  async onExecuteSync() {
    const targetId = this.state.activeTargetId();
    if (!targetId) return;

    const parse = (str: string) =>
      str
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const rules = {
      include: parse(this.ingestionIncludes()),
      exclude: parse(this.ingestionExcludes()),
    };

    try {
      await this.state.executeSync(targetId, rules);
    } catch (e) {
      // Errors handled by state service snackbars
    }
  }

  async onSaveDataSource(event: DataSourceSaveEvent) {
    this.dataSourcesManager.isSaving.set(true);
    try {
      await this.state.saveDataSource(event.payload, event.dataSourceId);
      this.dataSourcesManager.saveSuccess();
    } catch (error) {
      this.dataSourcesManager.isSaving.set(false);
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        data: {
          title: 'Save Failed',
          message:
            'Could not connect to the syncing microservice. Would you like to try saving again?',
          confirmText: 'Retry',
          confirmColor: 'primary',
          icon: 'cloud_off',
        },
      });
      const retry = await firstValueFrom(dialogRef.afterClosed());
      if (retry) {
        await this.onSaveDataSource(event);
      } else {
        this.dataSourcesManager.cancelEdit();
      }
    }
  }

  async onDeleteDataSource(sourceId: URN) {
    await this.state.deleteDataSource(sourceId);
  }
}
