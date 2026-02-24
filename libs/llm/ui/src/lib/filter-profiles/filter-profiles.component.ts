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
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
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
import { LlmFilterProfileFormComponent } from '../filter-profile-form/filter-profile-form.component';

export interface ProfileSaveEvent {
  payload: ProfileRequest;
  profileId?: string;
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
  delete = output<string>();

  // --- LOCAL SOT ---
  selectedProfileId = signal<string | null>(null);
  isEditing = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  saveError = signal<string | null>(null);

  // --- RESPONSIVE SOT ---
  // Returns true on mobile screens (< 768px)
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
    return this.profiles().find((p) => p.id === id) || null;
  });

  constructor() {
    // Safety check: If the active profile gets deleted by the parent, clear our selection
    effect(() => {
      const id = this.selectedProfileId();
      const currentProfiles = this.profiles();
      if (id && !currentProfiles.some((p) => p.id === id)) {
        this.selectedProfileId.set(null);
        this.isEditing.set(false);
      }
    });
  }

  // --- ACTIONS ---

  selectProfile(id: string) {
    this.selectedProfileId.set(id);
    this.isEditing.set(false);
  }

  onMobileSelect(value: string) {
    if (value === 'NEW') {
      this.createNew();
    } else if (value) {
      this.selectProfile(value);
    } else {
      this.selectedProfileId.set(null);
      this.isEditing.set(false);
    }
  }

  createNew() {
    this.selectedProfileId.set(null);
    this.isEditing.set(true);
  }

  editSelected(id: string) {
    this.selectedProfileId.set(id);
    this.isEditing.set(true);
  }

  cancelEdit() {
    this.isEditing.set(false);
    // If we were creating a new profile and cancelled, we have no active selection
    if (!this.selectedProfileId()) {
      // Revert to first profile if available
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
    this.isEditing.set(false); // Only close on actual success
  }

  saveFailed(errorMessage: string) {
    this.isSaving.set(false);
    this.saveError.set(errorMessage); // Keep form open and show error
  }

  onDelete(id: string) {
    this.delete.emit(id);
  }
}
