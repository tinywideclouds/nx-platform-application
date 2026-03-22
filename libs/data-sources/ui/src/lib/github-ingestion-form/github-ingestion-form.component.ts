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

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

import { GithubIngestionTarget } from '@nx-platform-application/data-sources-types';

export interface GithubIngestionFormPayload {
  repo: string;
  branch: string;
}

@Component({
  selector: 'github-ingestion-form',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './github-ingestion-form.component.html',
  styleUrl: './github-ingestion-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GithubIngestionFormComponent {
  // --- INPUTS ---
  githubTarget = input<GithubIngestionTarget | null>(null);
  isNew = input<boolean>(false);

  // --- OUTPUTS ---
  errorsChange = output<number>();
  saveGithubTarget = output<GithubIngestionFormPayload>();

  // --- LOCAL DRAFT STATE ---
  repo = signal<string>('');
  repoTouched = signal<boolean>(false);

  branch = signal<string>('main');
  branchTouched = signal<boolean>(false);

  constructor() {
    effect(() => {
      const githubTarget = this.githubTarget();
      const isNewGithubTarget = this.isNew();

      if (isNewGithubTarget) {
        this.repo.set('');
        this.branch.set('main');
        this.repoTouched.set(false);
        this.branchTouched.set(false);
      } else if (githubTarget) {
        this.repo.set(githubTarget.repo);
        this.branch.set(githubTarget.branch);
      }
    });

    effect(() => {
      this.errorsChange.emit(this.totalErrors());
    });
  }

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
    if (this.isNew()) {
      if (this.repoError()) count++;
      if (this.branchError()) count++;
    }
    return count;
  });

  triggerSave() {
    this.repoTouched.set(true);
    this.branchTouched.set(true);

    if (this.totalErrors() === 0 && this.isNew()) {
      this.saveGithubTarget.emit({
        repo: this.repo().trim(),
        branch: this.branch().trim(),
      });
    }
  }
}
