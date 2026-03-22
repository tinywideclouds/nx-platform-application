import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  signal,
  effect,
  untracked,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { URN } from '@nx-platform-application/platform-types';
import {
  DataGroup,
  DataGroupRequest,
  GithubIngestionTarget,
  DataSource,
} from '@nx-platform-application/data-sources-types';

import { DataSourcesClient } from '@nx-platform-application/data-sources-infrastructure-data-access';

interface GroupSourceEntry {
  targetId: string | null;
  streamId: string | null;
}

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
  ],
  templateUrl: './data-group-form.component.html',
  styleUrl: './data-group-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGroupFormComponent {
  private dataSourcesClient = inject(DataSourcesClient);

  // --- INPUTS & OUTPUTS ---
  group = input<DataGroup | null | undefined>(null);
  availableTargets = input<GithubIngestionTarget[]>([]);
  isEditing = input.required<boolean>();

  save = output<DataGroupRequest>();
  delete = output<URN>();
  cancel = output<void>();
  requestEdit = output<void>();

  // --- SIGNAL STATE ---
  name = signal<string>('');
  description = signal<string>('');
  sources = signal<GroupSourceEntry[]>([]);

  streamMap = signal<Record<string, DataSource[]>>({});

  isFormValid = computed(() => {
    if (!this.name().trim()) return false;
    const currentSources = this.sources();
    if (currentSources.length === 0) return false;
    // Every entry must have a selected stream
    return currentSources.every((s) => !!s.streamId);
  });

  constructor() {
    effect(() => {
      const activeGroup = this.group();
      untracked(() => {
        this.name.set(activeGroup?.name || '');
        this.description.set(activeGroup?.description || '');

        if (activeGroup && activeGroup.dataSourceIds.length > 0) {
          // Hydrate the array from existing URNs
          const loadedSources = activeGroup.dataSourceIds.map((id) => ({
            targetId: null, // Unknown at this stage since we only store the flat streamId
            streamId: id.toString(),
          }));
          this.sources.set(loadedSources);
        } else {
          // Start with one empty slot
          this.sources.set([]);
          this.addSource();
        }
      });
    });
  }

  // --- ACTIONS ---

  addSource(targetId: string | null = null, streamId: string | null = null) {
    this.sources.update((s) => [...s, { targetId, streamId }]);
    if (targetId) {
      this.fetchStreamsForTarget(targetId);
    }
  }

  removeSource(index: number) {
    this.sources.update((s) => s.filter((_, i) => i !== index));
  }

  onTargetSelected(targetId: string, index: number) {
    this.sources.update((s) => {
      const copy = [...s];
      copy[index] = { targetId, streamId: null };
      return copy;
    });
    this.fetchStreamsForTarget(targetId);
  }

  onStreamSelected(streamId: string, index: number) {
    this.sources.update((s) => {
      const copy = [...s];
      copy[index] = { ...copy[index], streamId };
      return copy;
    });
  }

  async fetchStreamsForTarget(targetIdStr: string) {
    if (this.streamMap()[targetIdStr]) return;

    try {
      const streams = await firstValueFrom(
        this.dataSourcesClient.listDataSources(URN.parse(targetIdStr)),
      );
      this.streamMap.update((map) => ({
        ...map,
        [targetIdStr]: streams,
      }));
    } catch (e) {
      console.error('Failed to fetch streams for dropdown', e);
    }
  }

  onSubmit() {
    if (!this.isFormValid()) return;

    const request: DataGroupRequest = {
      name: this.name().trim(),
      description: this.description().trim() || undefined,
      dataSourceIds: this.sources()
        .map((s) => (s.streamId ? URN.parse(s.streamId) : null))
        .filter(Boolean) as URN[],
    };

    this.save.emit(request);
  }
}
