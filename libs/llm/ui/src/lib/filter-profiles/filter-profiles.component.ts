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

// MATERIAL
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

// TYPES & COMPONENTS
import {
  FilterProfile,
  ProfileRequest,
} from '@nx-platform-application/llm-types';
import { URN } from '@nx-platform-application/platform-types';
import { LlmFilterProfileFormComponent } from '../filter-profile-form/filter-profile-form.component';

export interface ProfileSaveEvent {
  payload: ProfileRequest;
  // FIX: Interface correctly requires URN
  profileId?: URN;
}

@Component({
  selector: 'llm-filter-profiles',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    LlmFilterProfileFormComponent,
  ],
  templateUrl: './filter-profiles.component.html',
  styleUrl: './filter-profiles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmFilterProfilesComponent {
  private breakpointObserver = inject(BreakpointObserver);

  // --- INPUTS & OUTPUTS ---
  profiles = input<FilterProfile[]>([]);
  save = output<ProfileSaveEvent>();

  // FIX: Output expects URN
  delete = output<URN>();

  // --- LOCAL SOT ---
  // FIX: SOT explicitly types selection as URN
  selectedProfileId = signal<URN | null>(null);
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
  activeProfile = computed(() => {
    const id = this.selectedProfileId();
    if (!id) return null;
    // FIX: Structurally check URN equality
    return this.profiles().find((p) => p.id.equals(id)) || null;
  });

  constructor() {
    effect(() => {
      const id = this.selectedProfileId();
      const currentProfiles = this.profiles();
      // FIX: Structurally check URN equality
      if (id && !currentProfiles.some((p) => p.id.equals(id))) {
        this.selectedProfileId.set(null);
        this.isEditing.set(false);
      }
    });
  }

  // --- ACTIONS ---

  selectProfile(id: URN) {
    this.selectedProfileId.set(id);
    this.isEditing.set(false);
  }

  onMobileSelect(value: URN | 'NEW') {
    if (value === 'NEW') {
      this.createNew();
    } else if (value) {
      this.selectProfile(value);
    } else {
      this.selectedProfileId.set(null);
      this.isEditing.set(false);
    }
  }

  // Allows mat-select to correctly match the active URN object
  compareProfiles(a: URN | 'NEW' | null, b: URN | 'NEW' | null): boolean {
    if (!a || !b) return a === b;
    if (a === 'NEW' || b === 'NEW') return a === b;
    return (a as URN).equals(b as URN);
  }

  createNew() {
    this.selectedProfileId.set(null);
    this.isEditing.set(true);
  }

  editSelected(id: URN) {
    this.selectedProfileId.set(id);
    this.isEditing.set(true);
  }

  cancelEdit() {
    this.isEditing.set(false);
    if (!this.selectedProfileId()) {
      const all = this.profiles();
      if (all.length > 0) this.selectedProfileId.set(all[0].id);
    }
  }

  onSave(payload: ProfileRequest) {
    this.save.emit({
      payload,
      profileId: this.selectedProfileId() || undefined,
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
