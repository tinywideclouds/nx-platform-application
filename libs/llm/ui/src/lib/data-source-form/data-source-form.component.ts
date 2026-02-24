import {
  Component,
  input,
  output,
  effect,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// MATERIAL
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

// TYPES
import { CacheBundle } from '@nx-platform-application/llm-types';

export interface DataSourceFormPayload {
  repo: string;
  branch: string;
}

@Component({
  selector: 'llm-data-source-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './data-source-form.component.html',
  styleUrl: './data-source-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmDataSourceFormComponent {
  // --- INPUTS ---
  cache = input<CacheBundle | null>(null);
  isNew = input<boolean>(false);

  // --- OUTPUTS ---
  errorsChange = output<number>();
  saveRepo = output<DataSourceFormPayload>();

  // --- LOCAL DRAFT STATE ---
  repo = signal<string>('');
  repoTouched = signal<boolean>(false);

  branch = signal<string>('main');
  branchTouched = signal<boolean>(false);

  constructor() {
    // Sync external state to local draft
    effect(() => {
      const cacheData = this.cache();
      const isNewSource = this.isNew();

      if (isNewSource) {
        this.repo.set('');
        this.branch.set('main');
        this.repoTouched.set(false);
        this.branchTouched.set(false);
      } else if (cacheData) {
        this.repo.set(cacheData.repo);
        this.branch.set(cacheData.branch);
      }
    });

    // Bubble up error count to the parent page (for toolbar button disabling)
    effect(() => {
      this.errorsChange.emit(this.totalErrors());
    });
  }

  // --- VALIDATION (Computed) ---

  repoError = computed(() => {
    const val = this.repo().trim();
    if (!val) return 'Repository is required';
    if (!val.includes('/')) return 'Must be in owner/repo format';
    return null;
  });

  branchError = computed(() => {
    if (!this.branch().trim()) return 'Branch is required';
    return null;
  });

  totalErrors = computed(() => {
    let count = 0;
    // We only care about form validation errors if we are creating a new record
    if (this.isNew()) {
      if (this.repoError()) count++;
      if (this.branchError()) count++;
    }
    return count;
  });

  // --- ACTIONS ---

  // Exposed publicly for the Smart Page @ViewChild to call
  triggerSave() {
    this.repoTouched.set(true);
    this.branchTouched.set(true);

    if (this.totalErrors() === 0 && this.isNew()) {
      this.saveRepo.emit({
        repo: this.repo().trim(),
        branch: this.branch().trim(),
      });
    }
  }
}
