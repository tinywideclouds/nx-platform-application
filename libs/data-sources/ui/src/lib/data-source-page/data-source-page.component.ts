import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { map } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { DataSourceRequest } from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';

import { DataSourceFormComponent } from '../data-source-form/data-source-form.component';

@Component({
  selector: 'data-sources-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DataSourceFormComponent,
  ],
  templateUrl: './data-source-page.component.html',
  styleUrl: './data-source-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourcePageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  state = inject(DataSourcesService);

  // --- STATE ---
  sources = this.state.dataSources;

  isSaving = signal<boolean>(false);
  isEditing = signal<boolean>(false);

  // --- ROUTER STATE ---
  idParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))));

  selectedSourceId = computed(() => {
    const id = this.idParam();
    if (!id || id === 'new') return null;
    try {
      return URN.parse(id);
    } catch {
      return null;
    }
  });

  activeSource = computed(() => {
    const id = this.selectedSourceId();
    if (!id) return null;
    return this.sources().find((s) => s.id.equals(id)) || null;
  });

  constructor() {
    effect(() => {
      if (this.idParam() === 'new') {
        this.isEditing.set(true);
      } else {
        this.isEditing.set(false);
      }
    });
  }

  // --- ACTIONS ---

  editSelected() {
    this.isEditing.set(true);
  }

  cancelEdit() {
    if (this.idParam() === 'new') {
      this.router.navigate(['/data-sources/sources']);
    } else {
      this.isEditing.set(false);
    }
  }

  async onSave(event: { targetId: URN; payload: DataSourceRequest }) {
    this.isSaving.set(true);

    const savedId = await this.state.saveDataSource(
      event.payload,
      event.targetId,
      this.selectedSourceId() || undefined,
    );

    this.isSaving.set(false);

    if (savedId) {
      this.isEditing.set(false);
      this.router.navigate(['/data-sources/sources', savedId.toString()]);
    }
  }

  async onDelete(id: URN) {
    const source = this.activeSource();
    if (!source) return;

    await this.state.deleteDataSource(id);
    this.router.navigate(['/data-sources/sources']);
  }
}
