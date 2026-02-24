import {
  Component,
  output,
  input,
  effect,
  signal,
  computed,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';

import { URN } from '@nx-platform-application/platform-types';
import {
  LlmSession,
  SessionAttachment,
  ContextInjectionTarget,
} from '@nx-platform-application/llm-types';
import { LlmDataSourcesStateService } from '@nx-platform-application/llm-features-data-sources';

@Component({
  selector: 'llm-session-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatStepperModule,
    MatSelectModule,
    MatRadioModule,
  ],
  templateUrl: './session-form.component.html',
  styleUrl: './session-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmSessionFormComponent {
  dataSourcesState = inject(LlmDataSourcesStateService);

  // --- INPUTS & OUTPUTS ---
  session = input<LlmSession | null>(null);

  save = output<LlmSession>();
  delete = output<void>();

  // --- INLINE TITLE EDIT STATE ---
  isEditingTitle = signal(false);
  editTitleValue = signal('');

  // --- ATTACHMENTS STATE ---
  attachments = signal<SessionAttachment[]>([]);

  // --- STEPPER STATE ---
  isAddingSource = signal(false);
  selectedCacheId = signal<string | null>(null);
  selectedProfileId = signal<string | undefined>(undefined);
  selectedTarget = signal<ContextInjectionTarget>('inline-context');

  // --- COMPUTED ---
  contextGroupEntries = computed(() => {
    const groups = this.session()?.contextGroups || {};
    return Object.entries(groups).map(([urn, name]) => ({ urn, name }));
  });

  constructor() {
    this.dataSourcesState.loadAllCaches();

    effect(() => {
      const s = this.session();
      if (s) {
        // Sync local attachments with the Single Source of Truth
        this.attachments.set(s.attachments ? [...s.attachments] : []);
        // Reset the title input buffer if we aren't actively typing in it
        if (!this.isEditingTitle()) {
          this.editTitleValue.set(s.title || '');
        }
      }
    });
  }

  // --- TITLE ACTIONS ---

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

  // --- ATTACHMENT WIZARD ACTIONS ---

  startAddingSource(): void {
    this.isAddingSource.set(true);
    this.selectedCacheId.set(null);
    this.selectedProfileId.set(undefined);
    this.selectedTarget.set('inline-context');
  }

  cancelAddingSource(): void {
    this.isAddingSource.set(false);
  }

  async onCacheSelected(cacheId: string): Promise<void> {
    this.selectedCacheId.set(cacheId);
    this.selectedProfileId.set(undefined);
    await this.dataSourcesState.selectCache(cacheId);
  }

  confirmAddSource(): void {
    const cId = this.selectedCacheId();
    if (!cId || !this.session()) return;

    const newAtt: SessionAttachment = {
      id: crypto.randomUUID(),
      cacheId: URN.parse(cId),
      profileId: this.selectedProfileId()
        ? URN.parse(this.selectedProfileId()!)
        : undefined,
      target: this.selectedTarget(),
    };

    // Emit save immediately!
    this.save.emit({
      ...this.session()!,
      attachments: [...this.attachments(), newAtt],
    });

    this.isAddingSource.set(false);
  }

  removeAttachment(id: string): void {
    if (!this.session()) return;

    // Emit save immediately!
    this.save.emit({
      ...this.session()!,
      attachments: this.attachments().filter((a) => a.id !== id),
    });
  }

  onDelete(): void {
    this.delete.emit();
  }
}
