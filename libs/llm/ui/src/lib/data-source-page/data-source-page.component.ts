import {
  Component,
  inject,
  computed,
  signal,
  ViewChild,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

// MATERIAL
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

// STATE & COMPONENTS
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

  // --- ROUTING & PAGE STATE ---
  private routeId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
  );

  isNew = computed(() => this.routeId() === null);
  formErrorCount = signal<number>(0);

  // --- INGESTION FILTERS (Local State) ---
  ingestionIncludes = signal<string>('**/*');
  ingestionExcludes = signal<string>('node_modules/**, vendor/**, .git/**');

  // --- COMPUTED BRANCHES ---
  availableBranches = computed(() => {
    const activeRepo = this.state.activeCache()?.repo;
    if (!activeRepo) return [];
    return this.state.groupedCaches()[activeRepo] || [];
  });

  constructor() {
    effect(() => {
      const id = this.routeId();
      if (this.isNew()) {
        this.state.clearSelection();
      } else if (id) {
        this.state.selectCache(id);
      }
    });
  }

  // --- REPO & BRANCH ACTIONS ---

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

  // --- SYNC EXECUTION ---

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

  // --- PROFILE ACTIONS ---

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
