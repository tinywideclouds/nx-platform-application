import {
  Component,
  output,
  input,
  effect,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { LlmContextHierarchyComponent } from '../context-hierarchy/context-hierarchy.component';

import {
  LlmSession,
  SessionAttachment,
} from '@nx-platform-application/llm-types';
import { URN } from '@nx-platform-application/platform-types';

@Component({
  selector: 'llm-session-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    LlmContextHierarchyComponent,
  ],
  templateUrl: './session-form.component.html',
  styleUrl: './session-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmSessionFormComponent {
  session = input<LlmSession | null>(null);

  save = output<LlmSession>();
  delete = output<void>();

  isEditingTitle = signal(false);
  editTitleValue = signal('');
  attachments = signal<SessionAttachment[]>([]);

  contextGroupEntries = computed(() => {
    const groups = this.session()?.contextGroups || {};
    return Object.entries(groups).map(([urn, name]) => ({ urn, name }));
  });

  constructor() {
    effect(() => {
      const s = this.session();
      if (s) {
        this.attachments.set(s.attachments ? [...s.attachments] : []);
        if (!this.isEditingTitle()) {
          this.editTitleValue.set(s.title || '');
        }
      }
    });
  }

  startTitleEdit(): void {
    this.editTitleValue.set(this.session()?.title || '');
    this.isEditingTitle.set(true);
  }

  cancelTitleEdit(): void {
    this.isEditingTitle.set(false);
  }

  saveTitle(): void {
    const newTitle = this.editTitleValue().trim();
    if (newTitle && this.session()) {
      this.save.emit({ ...this.session()!, title: newTitle });
    }
    this.isEditingTitle.set(false);
  }

  removeAttachment(id: URN): void {
    if (!this.session()) return;

    this.save.emit({
      ...this.session()!,
      attachments: this.attachments().filter((a) => !a.id.equals(id)),
    });
  }

  onDelete(): void {
    this.delete.emit();
  }
}
