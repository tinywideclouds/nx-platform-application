import {
  Component,
  output,
  inject,
  input,
  effect,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// MATERIAL IMPORTS (Drastically reduced)
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// NEW CHILD COMPONENTS
import { LlmDataSourceStepperComponent } from '../data-source-stepper/data-source-stepper.component';
import { LlmContextHierarchyComponent } from '../context-hierarchy/context-hierarchy.component';

import { LlmDataSourcesStateService } from '@nx-platform-application/llm-features-data-sources';
import {
  LlmSession,
  SessionAttachment,
} from '@nx-platform-application/llm-types';
import { Temporal } from '@js-temporal/polyfill';

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
    LlmDataSourceStepperComponent,
    LlmContextHierarchyComponent,
  ],
  templateUrl: './session-form.component.html',
  styleUrl: './session-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmSessionFormComponent {
  // NEW: Inject state to check for existing data sources
  dataSourcesState = inject(LlmDataSourcesStateService);

  // NEW: Computed property to check if caches exist
  hasDataSources = computed(() => this.dataSourcesState.caches().length > 0);
  // --- INPUTS & OUTPUTS ---
  session = input<LlmSession | null>(null);

  // NEW: Pass-through for compilation
  isCompiling = input<boolean>(false);
  compileCache = output<void>();

  save = output<LlmSession>();
  delete = output<void>();

  // --- INLINE TITLE EDIT STATE ---
  isEditingTitle = signal(false);
  editTitleValue = signal('');

  // --- ATTACHMENTS STATE ---
  attachments = signal<SessionAttachment[]>([]);
  isAddingSource = signal(false);

  // --- COMPUTED ---
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

  // --- ATTACHMENT ORCHESTRATION ---
  startAddingSource(): void {
    this.isAddingSource.set(true);
  }

  cancelAddingSource(): void {
    this.isAddingSource.set(false);
  }

  confirmAddSource(newAtt: SessionAttachment): void {
    if (!this.session()) return;

    // CACHE DRIFT: If they target the compiled cache, the compiled ID is now invalid
    const hasCacheDrift = newAtt.target === 'compiled-cache';

    this.save.emit({
      ...this.session()!,
      attachments: [...this.attachments(), newAtt],
      compiledCache: hasCacheDrift ? undefined : this.session()?.compiledCache,
    });

    this.isAddingSource.set(false);
  }

  removeAttachment(id: string): void {
    if (!this.session()) return;

    const targetAtt = this.attachments().find((a) => a.id.toString() === id);
    const hasCacheDrift = targetAtt?.target === 'compiled-cache';

    this.save.emit({
      ...this.session()!,
      attachments: this.attachments().filter((a) => a.id.toString() !== id),
      compiledCache: hasCacheDrift ? undefined : this.session()?.compiledCache,
    });
  }

  isCacheExpired(expiresAt: string): boolean {
    const now = Temporal.Now.instant();
    const expiry = Temporal.Instant.from(expiresAt);
    return Temporal.Instant.compare(now, expiry) >= 0;
  }

  formatExpiry(expiresAt: string): string {
    const expiry = Temporal.Instant.from(expiresAt).toZonedDateTimeISO(
      Temporal.Now.timeZoneId(),
    );
    return `${expiry.month}/${expiry.day} at ${expiry.hour.toString().padStart(2, '0')}:${expiry.minute.toString().padStart(2, '0')}`;
  }

  onDelete(): void {
    this.delete.emit();
  }
}
