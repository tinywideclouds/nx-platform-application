import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

import {
  DataSource,
  DataSourceRequest,
} from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';
import { DataSourceFormComponent } from '../data-source-form/data-source-form.component';

export interface DataSourceSaveEvent {
  payload: DataSourceRequest;
  dataSourceId?: URN;
}

@Component({
  selector: 'data-sources-list', // Matched to github-ingestion-page selector
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    DataSourceFormComponent,
  ],
  templateUrl: './data-source-page.component.html',
  styleUrl: './data-source-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourcesComponent {
  private breakpointObserver = inject(BreakpointObserver);

  // --- INPUTS & OUTPUTS ---
  sources = input<DataSource[]>([]);
  save = output<DataSourceSaveEvent>();
  delete = output<URN>();

  // --- LOCAL SOT ---
  selectedSourceId = signal<URN | null>(null);
  isEditing = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  saveError = signal<string | null>(null);

  // --- RESPONSIVE SOT ---
  isMobile = toSignal(
    this.breakpointObserver
      .observe('(max-width: 767px)')
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // --- COMPUTED STATE ---
  activeSource = computed(() => {
    const id = this.selectedSourceId();
    if (!id) return null;
    return this.sources().find((s) => s.id.equals(id)) || null;
  });

  constructor() {
    effect(() => {
      const id = this.selectedSourceId();
      const currentSources = this.sources();
      if (id && !currentSources.some((s) => s.id.equals(id))) {
        this.selectedSourceId.set(null);
        this.isEditing.set(false);
      }
    });
  }

  // --- ACTIONS ---

  selectSource(id: URN) {
    this.selectedSourceId.set(id);
    this.isEditing.set(false);
  }

  onMobileSelect(value: URN | 'NEW') {
    if (value === 'NEW') {
      this.createNew();
    } else if (value) {
      this.selectSource(value);
    } else {
      this.selectedSourceId.set(null);
      this.isEditing.set(false);
    }
  }

  compareSources(a: URN | 'NEW' | null, b: URN | 'NEW' | null): boolean {
    if (!a || !b) return a === b;
    if (a === 'NEW' || b === 'NEW') return a === b;
    return (a as URN).equals(b as URN);
  }

  createNew() {
    this.selectedSourceId.set(null);
    this.isEditing.set(true);
  }

  editSelected(id: URN) {
    this.selectedSourceId.set(id);
    this.isEditing.set(true);
  }

  cancelEdit() {
    this.isEditing.set(false);
    if (!this.selectedSourceId()) {
      const all = this.sources();
      if (all.length > 0) this.selectedSourceId.set(all[0].id);
    }
  }

  onSave(payload: DataSourceRequest) {
    this.save.emit({
      payload,
      dataSourceId: this.selectedSourceId() || undefined,
    });
    this.isEditing.set(false);
  }

  saveSuccess() {
    this.isSaving.set(false);
    this.isEditing.set(false);
  }

  saveFailed(errorMessage: string) {
    this.isSaving.set(false);
    this.saveError.set(errorMessage);
  }

  onDelete(id: URN) {
    this.delete.emit(id);
  }
}
