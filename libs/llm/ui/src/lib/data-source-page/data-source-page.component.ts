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
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { LlmDataSourcesStateService } from '@nx-platform-application/llm-features-data-sources';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';
import {
  LlmDataSourceFormComponent,
  DataSourceFormPayload,
} from '../data-source-form/data-source-form.component';
import {
  LlmFilterProfilesComponent,
  ProfileSaveEvent,
} from '../filter-profiles/filter-profiles.component';
import { LlmDataSourceAnalysisComponent } from '../data-source-analysis/data-source-analysis.component';
import { LlmDataSourceHeaderComponent } from '../data-source-header/data-source-header.component';

@Component({
  selector: 'llm-data-source-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSelectModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    LlmDataSourceFormComponent,
    LlmFilterProfilesComponent,
    LlmDataSourceAnalysisComponent,
    LlmDataSourceHeaderComponent,
  ],
  templateUrl: './data-source-page.component.html',
  styleUrl: './data-source-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmDataSourcePageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  state = inject(LlmDataSourcesStateService);

  @ViewChild(LlmDataSourceFormComponent)
  formComponent!: LlmDataSourceFormComponent;

  @ViewChild(LlmFilterProfilesComponent)
  profileManager!: LlmFilterProfilesComponent;

  // Derive the ID synchronously for UI bindings
  id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))));
  isNew = computed(() => !this.id() || this.id() === 'new');

  formErrorCount = signal<number>(0);
  ingestionIncludes = signal<string>('**/*');
  ingestionExcludes = signal<string>('node_modules/**, vendor/**, .git/**');

  availableBranches = computed(() => {
    const activeRepo = this.state.activeCache()?.repo;
    if (!activeRepo) return [];
    return this.state.groupedCaches()[activeRepo] || [];
  });

  constructor() {
    // FIX: Safely orchestrate state mutations based on router events using RxJS
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const routeId = params.get('id');
      if (!routeId || routeId === 'new') {
        this.state.clearSelection();
      } else {
        this.state.selectCache(routeId);
      }
    });
  }

  triggerFormSave() {
    if (this.formComponent) this.formComponent.triggerSave();
  }

  async onSaveRepo(payload: DataSourceFormPayload) {
    if (!payload.repo || !payload.branch) return;
    const newCacheId = await this.state.createCache({
      repo: payload.repo,
      branch: payload.branch,
    });
    if (newCacheId) this.router.navigate(['/data-sources', newCacheId]);
  }

  async onBranchChange(value: string) {
    if (value === 'NEW') {
      const repo = this.state.activeCache()?.repo;
      if (!repo) return;
      const newBranch = prompt(
        `Enter new branch name to track for ${repo}:`,
        'main',
      );
      if (newBranch) {
        const newCacheId = await this.state.createCache({
          repo,
          branch: newBranch,
        });
        if (newCacheId) this.router.navigate(['/data-sources', newCacheId]);
      }
    } else if (value) {
      this.router.navigate(['/data-sources', value]);
    }
  }

  onCancel() {
    this.router.navigate(['/data-sources']);
  }

  async onExecuteSync() {
    const cacheId = this.state.activeCacheId();
    if (!cacheId) return;

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
      await this.state.executeSync(cacheId, rules);
    } catch (e) {
      // Errors handled by state service snackbars
    }
  }

  async onSaveProfile(event: ProfileSaveEvent) {
    this.profileManager.isSaving.set(true);
    try {
      await this.state.saveProfile(event.payload, event.profileId);
      this.profileManager.saveSuccess();
    } catch (error) {
      this.profileManager.isSaving.set(false);
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
        await this.onSaveProfile(event);
      } else {
        this.profileManager.cancelEdit();
      }
    }
  }

  async onDeleteProfile(profileId: string) {
    await this.state.deleteProfile(profileId);
  }
}
