import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  signal,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
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
  DataSourceBundle,
  FilterProfile,
} from '@nx-platform-application/data-sources-types';

// Inject the specific client to fetch profiles for the dropdowns
import { FilterProfilesClient } from '@nx-platform-application/data-sources-infrastructure-data-access';

@Component({
  selector: 'data-sources-group-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './data-group-form.component.html',
  styles: [
    `
      .subscript-hidden ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGroupFormComponent {
  private fb = inject(FormBuilder);
  private profilesClient = inject(FilterProfilesClient);

  // --- INPUTS & OUTPUTS ---
  group = input<DataGroup | null | undefined>(null);
  availableSources = input<DataSourceBundle[]>([]);
  isEditing = input.required<boolean>();

  save = output<DataGroupRequest>();
  delete = output<URN>();
  cancel = output<void>();
  requestEdit = output<void>();

  // --- STATE ---
  // Caches fetched profiles by DataSource ID so dropdowns can read them synchronously
  profileMap = signal<Record<string, FilterProfile[]>>({});

  form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    sources: this.fb.array([] as FormGroup[]),
  });

  get sources() {
    return this.form.get('sources') as FormArray;
  }

  constructor() {
    // Hydrate form when the active group changes
    effect(() => {
      const activeGroup = this.group();
      untracked(() => {
        this.form.reset({
          name: activeGroup?.name || '',
          description: activeGroup?.description || '',
        });

        this.sources.clear();

        if (activeGroup && activeGroup.sources.length > 0) {
          activeGroup.sources.forEach((s) => {
            this.addSource(s.dataSourceId.toString(), s.profileId?.toString());
          });
        } else {
          this.addSource();
        }
      });
    });

    // Automatically disable/enable the dropdowns based on edit mode
    effect(() => {
      if (this.isEditing()) {
        this.sources.enable({ emitEvent: false });
      } else {
        this.sources.disable({ emitEvent: false });
      }
    });
  }

  addSource(dataSourceIdStr?: string, profileIdStr?: string) {
    const sourceGroup = this.fb.group({
      dataSourceId: [dataSourceIdStr || null, Validators.required],
      profileId: [profileIdStr || null],
    });

    this.sources.push(sourceGroup);

    if (dataSourceIdStr) {
      this.fetchProfilesForSource(dataSourceIdStr);
    }
  }

  removeSource(index: number) {
    this.sources.removeAt(index);
  }

  onRepoSelected(dataSourceIdStr: string, index: number) {
    // Reset the profile selection when the repository changes
    const sourceGroup = this.sources.at(index) as FormGroup;
    sourceGroup.get('profileId')?.setValue(null);

    this.fetchProfilesForSource(dataSourceIdStr);
  }

  async fetchProfilesForSource(dataSourceIdStr: string) {
    // Skip if we already fetched profiles for this repo
    if (this.profileMap()[dataSourceIdStr]) return;

    try {
      const profiles = await firstValueFrom(
        this.profilesClient.listProfiles(URN.parse(dataSourceIdStr)),
      );
      this.profileMap.update((map) => ({
        ...map,
        [dataSourceIdStr]: profiles,
      }));
    } catch (e) {
      console.error('Failed to fetch profiles for dropdown', e);
    }
  }

  onSubmit() {
    if (this.form.invalid || this.sources.length === 0) return;

    const val = this.form.value;
    const request: DataGroupRequest = {
      name: val.name!,
      description: val.description || undefined,
      sources: val.sources!.map((s: any) => ({
        dataSourceId: URN.parse(s.dataSourceId),
        profileId: s.profileId ? URN.parse(s.profileId) : undefined,
      })),
    };

    this.save.emit(request);
  }
}
