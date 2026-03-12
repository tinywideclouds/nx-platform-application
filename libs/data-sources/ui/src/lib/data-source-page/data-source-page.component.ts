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

import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';
import { URN } from '@nx-platform-application/platform-types';
import {
  DataSourceFormComponent,
  DataSourceFormPayload,
} from '../data-source-form/data-source-form.component';
import {
  FilterProfilesComponent,
  ProfileSaveEvent,
} from '../filter-profiles/filter-profiles.component';
import { DataSourceAnalysisComponent } from '../data-source-analysis/data-source-analysis.component';
import { DataSourceHeaderComponent } from '../data-source-header/data-source-header.component';

@Component({
  selector: 'data-sources-page',
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
    DataSourceFormComponent,
    FilterProfilesComponent,
    DataSourceAnalysisComponent,
    DataSourceHeaderComponent,
  ],
  templateUrl: './data-source-page.component.html',
  styleUrl: './data-source-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourcePageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  state = inject(DataSourcesService);

  @ViewChild(DataSourceFormComponent)
  formComponent!: DataSourceFormComponent;

  @ViewChild(FilterProfilesComponent)
  profileManager!: FilterProfilesComponent;

  id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))));
  isNew = computed(() => !this.id() || this.id() === 'new');

  formErrorCount = signal<number>(0);
  ingestionIncludes = signal<string>('**/*');
  ingestionExcludes = signal<string>('node_modules/**, vendor/**, .git/**');

  availableBranches = computed(() => {
    const activeRepo = this.state.activeDataSource()?.repo;
    if (!activeRepo) return [];
    return this.state.groupedDataSources()[activeRepo] || [];
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const routeId = params.get('id');
      if (!routeId || routeId === 'new') {
        this.state.clearSelection();
      } else {
        try {
          this.state.selectDataSource(URN.parse(routeId));
        } catch (e) {
          this.router.navigate(['/data-sources']);
        }
      }
    });
  }

  triggerFormSave() {
    if (this.formComponent) this.formComponent.triggerSave();
  }

  async onSaveRepo(payload: DataSourceFormPayload) {
    if (!payload.repo || !payload.branch) return;
    const newDataSourceId = await this.state.createDataSource({
      repo: payload.repo,
      branch: payload.branch,
    });
    if (newDataSourceId)
      this.router.navigate(['/data-sources', newDataSourceId.toString()]);
  }

  async onBranchChange(value: string) {
    if (value === 'NEW') {
      const repo = this.state.activeDataSource()?.repo;
      if (!repo) return;
      const newBranch = prompt(
        `Enter new branch name to track for ${repo}:`,
        'main',
      );
      if (newBranch) {
        const newDataSourceId = await this.state.createDataSource({
          repo,
          branch: newBranch,
        });
        if (newDataSourceId)
          this.router.navigate(['/data-sources', newDataSourceId.toString()]);
      }
    } else if (value) {
      this.router.navigate(['/data-sources', value]);
    }
  }

  onCancel() {
    this.router.navigate(['/data-sources']);
  }

  async onExecuteSync() {
    const dataSourceId = this.state.activeDataSourceId();
    if (!dataSourceId) return;

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
      await this.state.executeSync(dataSourceId, rules);
    } catch (e) {
      // Errors handled by state service snackbars
    }
  }

  async onSaveProfile(event: ProfileSaveEvent) {
    this.profileManager.isSaving.set(true);
    try {
      // UPDATED TO CALL STATE INSTEAD OF ACTIONS
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

  async onDeleteProfile(profileId: URN) {
    // UPDATED TO CALL STATE INSTEAD OF ACTIONS
    await this.state.deleteProfile(profileId);
  }
}
