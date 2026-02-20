import {
  Component,
  output,
  input,
  effect,
  signal,
  computed,
  ChangeDetectionStrategy,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import { LlmSession } from '@nx-platform-application/llm-types';

@Component({
  selector: 'llm-session-form',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './session-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmSessionFormComponent {
  private el = inject(ElementRef);

  // --- INPUTS ---
  session = input<LlmSession | null>(null);
  isEditing = input.required<boolean>();

  // --- OUTPUTS ---
  save = output<LlmSession>();
  delete = output<void>();
  errorsChange = output<number>();
  requestEdit = output<void>();

  // --- FORM STATE ---
  title = signal('');
  titleTouched = signal(false);

  cacheId = signal('');
  systemPromptsId = signal('');

  // --- BREADCRUMBS ---
  titleModified = computed(
    () => this.title() !== (this.session()?.title ?? ''),
  );
  cacheIdModified = computed(
    () => this.cacheId() !== (this.session()?.cacheId ?? ''),
  );
  promptsModified = computed(
    () => this.systemPromptsId() !== (this.session()?.systemPromptsId ?? ''),
  );

  // --- VALIDATION ---
  titleError = computed(() => {
    if (!this.title().trim()) return 'Session title is required';
    return null;
  });

  errorCount = computed(() => {
    let count = 0;
    if (this.titleError()) count++;
    return count;
  });

  isValid = computed(() => this.errorCount() === 0);

  // Derived state for the read-only Context Groups dictionary
  contextGroupEntries = computed(() => {
    const groups = this.session()?.contextGroups || {};
    return Object.entries(groups).map(([urn, name]) => ({ urn, name }));
  });

  constructor() {
    effect(() => {
      const s = this.session();
      if (s) {
        this.title.set(s.title ?? '');
        this.cacheId.set(s.cacheId ?? '');
        this.systemPromptsId.set(s.systemPromptsId ?? '');
      }
      this.resetTouched();
    });

    effect(() => {
      this.errorsChange.emit(this.errorCount());
    });
  }

  // --- PUBLIC API ---

  triggerSave(): void {
    this.titleTouched.set(true);

    if (!this.isValid()) {
      const invalidInput =
        this.el.nativeElement.querySelector('input.ng-invalid');
      if (invalidInput) invalidInput.focus();
      return;
    }

    if (this.session()) {
      const updated: LlmSession = {
        ...this.session()!,
        title: this.title().trim(),
        cacheId: this.cacheId().trim() || undefined,
        systemPromptsId: this.systemPromptsId().trim() || undefined,
      };
      this.save.emit(updated);
    }
  }

  triggerEditMode(): void {
    this.requestEdit.emit();
  }

  onDelete(): void {
    this.delete.emit();
  }

  private resetTouched() {
    this.titleTouched.set(false);
  }
}
