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

import {
  LlmSession,
  SessionAttachment,
} from '@nx-platform-application/llm-types';

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

  // --- INPUTS & OUTPUTS ---
  session = input<LlmSession | null>(null);
  isEditing = input.required<boolean>();

  save = output<LlmSession>();
  delete = output<void>();
  errorsChange = output<number>();
  requestEdit = output<void>();

  // --- FORM STATE ---
  title = signal('');
  titleTouched = signal(false);

  // NEW: The core attachments array
  attachments = signal<SessionAttachment[]>([]);

  // --- BREADCRUMBS ---
  titleModified = computed(
    () => this.title() !== (this.session()?.title ?? ''),
  );

  // A simple check to see if the lengths or contents have drifted
  attachmentsModified = computed(() => {
    const original = this.session()?.attachments || [];
    const current = this.attachments();
    return JSON.stringify(original) !== JSON.stringify(current);
  });

  // --- VALIDATION ---
  titleError = computed(() => {
    if (!this.title().trim()) return 'Session title is required';
    return null;
  });

  errorCount = computed(() => (this.titleError() ? 1 : 0));
  isValid = computed(() => this.errorCount() === 0);

  contextGroupEntries = computed(() => {
    const groups = this.session()?.contextGroups || {};
    return Object.entries(groups).map(([urn, name]) => ({ urn, name }));
  });

  constructor() {
    effect(() => {
      const s = this.session();
      if (s) {
        this.title.set(s.title ?? '');
        // Clone the array so local mutations don't instantly bleed into global state
        this.attachments.set(s.attachments ? [...s.attachments] : []);
      }
      this.titleTouched.set(false);
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
        attachments: this.attachments(),
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
}
