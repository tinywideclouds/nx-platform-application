import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  effect,
  untracked,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { URN } from '@nx-platform-application/platform-types';
import {
  DataGroup,
  DataGroupRequest,
  DataSource,
  FileAnalysis,
} from '@nx-platform-application/data-sources-types';

import { FileAnalysisSummaryComponent } from '../file-analysis-summary/file-analysis-summary.component';

@Component({
  selector: 'data-sources-group-form',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FileAnalysisSummaryComponent,
  ],
  templateUrl: './data-group-form.component.html',
  styleUrl: './data-group-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGroupFormComponent {
  // --- INPUTS & OUTPUTS ---
  group = input<DataGroup | null | undefined>(null);
  availableStreams = input<DataSource[]>([]);
  isEditing = input.required<boolean>();

  save = output<DataGroupRequest>();
  delete = output<URN>();
  cancel = output<void>();
  requestEdit = output<void>();

  // --- SIGNAL STATE ---
  name = signal<string>('');
  description = signal<string>('');

  // Just an array of selected DataSource URN strings
  sources = signal<string[]>([]);

  isFormValid = computed(() => {
    if (!this.name().trim()) return false;
    const currentSources = this.sources();
    if (currentSources.length === 0) return false;
    // Every entry must have a truthy, selected stream ID
    return currentSources.every((s) => !!s);
  });

  // NEW: Live Aggregation of the selected streams
  aggregatedAnalysis = computed(() => {
    const selectedSourceIds = this.sources().filter(Boolean);
    if (selectedSourceIds.length === 0) return null;

    const available = this.availableStreams();
    const selectedSources = available.filter((s) =>
      selectedSourceIds.includes(s.id.toString()),
    );

    if (selectedSources.length === 0) return null;

    const agg: FileAnalysis = {
      totalSizeBytes: 0,
      totalFiles: 0,
      extensions: {},
      directories: [],
    };

    const dirSet = new Set<string>();

    for (const s of selectedSources) {
      if (s.analysis) {
        agg.totalSizeBytes += s.analysis.totalSizeBytes;
        agg.totalFiles += s.analysis.totalFiles;

        for (const [ext, count] of Object.entries(
          s.analysis.extensions || {},
        )) {
          agg.extensions[ext] = (agg.extensions[ext] || 0) + count;
        }

        for (const d of s.analysis.directories || []) {
          dirSet.add(d);
        }
      }
    }

    agg.directories = Array.from(dirSet);
    return agg;
  });

  constructor() {
    effect(() => {
      const activeGroup = this.group();
      const editing = this.isEditing();

      untracked(() => {
        this.name.set(activeGroup?.name || '');
        this.description.set(activeGroup?.description || '');

        if (activeGroup && activeGroup.dataSourceIds.length > 0) {
          // Hydrate the array from existing URNs
          this.sources.set(
            activeGroup.dataSourceIds.map((id) => id.toString()),
          );
        } else {
          // Start empty, add a slot if we are creating a new one
          this.sources.set([]);
          if (editing) this.addSource();
        }
      });
    });
  }

  // --- ACTIONS ---

  addSource() {
    this.sources.update((s) => [...s, '']);
  }

  removeSource(index: number) {
    this.sources.update((s) => s.filter((_, i) => i !== index));
  }

  onStreamSelected(streamId: string, index: number) {
    this.sources.update((s) => {
      const copy = [...s];
      copy[index] = streamId;
      return copy;
    });
  }

  onSubmit() {
    if (!this.isFormValid()) return;

    const request: DataGroupRequest = {
      name: this.name().trim(),
      description: this.description().trim() || undefined,
      dataSourceIds: this.sources()
        .filter(Boolean)
        .map((id) => URN.parse(id)),
    };

    this.save.emit(request);
  }
}
