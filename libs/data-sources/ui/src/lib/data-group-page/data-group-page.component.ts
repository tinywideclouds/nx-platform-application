import {
  Component,
  inject,
  computed,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';

import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { URN } from '@nx-platform-application/platform-types';
import { DataGroupRequest } from '@nx-platform-application/data-sources-types';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';

import { DataGroupFormComponent } from '../data-group-form/data-group-form.component';

@Component({
  selector: 'data-sources-group-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DataGroupFormComponent,
  ],
  templateUrl: './data-group-page.component.html',
  styleUrl: './data-group-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGroupPageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  state = inject(DataSourcesService);

  id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))));
  isNew = computed(() => this.id() === 'new');

  // Track the edit modality
  isEditing = signal<boolean>(false);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const routeId = params.get('id');
      if (!routeId || routeId === 'new') {
        this.state.activeDataGroupId.set(null);
        this.isEditing.set(true); // Always edit a new blueprint
      } else {
        this.isEditing.set(false); // Default to View Mode
        try {
          this.state.activeDataGroupId.set(URN.parse(routeId));
        } catch (e) {
          this.router.navigate(['/data-sources/groups']);
        }
      }
    });
  }

  goToNewRepo() {
    this.router.navigate(['/data-sources/repos/new']);
  }

  // --- ACTIONS ---

  async onSave(req: DataGroupRequest) {
    const active = this.state.activeDataGroup();

    // Preserve the opaque metadata
    if (active && active.metadata) {
      req.metadata = active.metadata;
    }

    const newId = await this.state.saveDataGroup(req, active?.id);

    // Drop back into View Mode
    this.isEditing.set(false);

    if (newId && this.isNew()) {
      this.router.navigate(['/data-sources/groups', newId.toString()]);
    }
  }

  async onDelete(id: URN) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      data: {
        title: 'Delete Context Blueprint',
        message:
          'Are you sure you want to delete this blueprint? This will NOT delete the underlying repositories or their files.',
        confirmText: 'Delete Blueprint',
        confirmColor: 'warn',
        icon: 'warning',
      },
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (confirmed) {
      await this.state.deleteDataGroup(id);
      this.router.navigate(['/data-sources/groups']);
    }
  }

  onCancel() {
    if (this.isNew()) {
      this.router.navigate(['/data-sources/groups']);
    } else {
      this.isEditing.set(false); // Revert to View Mode
    }
  }
}
