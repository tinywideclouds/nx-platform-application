import {
  Component,
  output,
  input,
  effect,
  signal,
  computed,
  ChangeDetectionStrategy,
  inject,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';

import { LlmContextHierarchyComponent } from '../context-hierarchy/context-hierarchy.component';

import {
  LlmSession,
  WorkspaceAttachment,
  LlmModelStrategy,
  MemoryStrategyProfile,
} from '@nx-platform-application/llm-types';
import { URN } from '@nx-platform-application/platform-types';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';
import { defaultMemoryProfiles } from '@nx-platform-application/llm-domain-context';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { DataSourceResolver } from '@nx-platform-application/llm-features-workspace';

import {
  ContextPickerDialogComponent,
  ContextPickerResult,
} from '@nx-platform-application/data-sources-ui';

import { LlmModelRegistryService } from '@nx-platform-application/llm-tools-model-registry';

@Component({
  selector: 'llm-session-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatRadioModule,
    MatCheckboxModule,
    MatDialogModule,
    MatTabsModule,
    LlmContextHierarchyComponent,
  ],
  templateUrl: './session-form.component.html',
  styleUrl: './session-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmSessionFormComponent {
  private readonly sessionActions = inject(LlmSessionActions);
  private readonly cacheService = inject(CompiledCacheService);
  private readonly resolver = inject(DataSourceResolver);
  private readonly dataSources = inject(DataSourcesService);

  private modelRegistry = inject(LlmModelRegistryService);

  private readonly dialog = inject(MatDialog);

  session = input<LlmSession | null>(null);
  save = output<LlmSession>();
  delete = output<void>();

  isEditingTitle = signal(false);
  editTitleValue = signal('');

  // UI display masking for technical resource names
  readonly availableModels = computed(() => {
    return this.modelRegistry.profiles().map((p) => ({
      label: p.displayName,
      value: p.id,
    }));
  });

  activeProfiles = computed(() => {
    return this.session()?.strategy?.memoryProfiles || defaultMemoryProfiles;
  });

  contextGroupEntries = computed(() => {
    const groups = this.session()?.contextGroups || {};
    return Object.entries(groups).map(([urn, name]) => ({ urn, name }));
  });

  constructor() {
    effect(() => {
      untracked(() => {
        this.dataSources.loadAllDataSources();
        this.dataSources.loadAllDataGroups();
      });
    });

    effect(() => {
      const s = this.session();
      if (s && !this.isEditingTitle()) {
        untracked(() => this.editTitleValue.set(s.title || ''));
      }
    });
  }

  /**
   * Updates specific strategy fields while preserving the overall session contract.
   */
  updateStrategy(field: keyof LlmModelStrategy, value: any) {
    const s = this.session();
    if (!s) return;

    // Default strategy fallback for legacy sessions
    const currentStrategy: LlmModelStrategy = s.strategy || {
      primaryModel: s.llmModel,
      secondaryModel: 'gemini-3.1-pro-preview',
      secondaryModelLimit: 1,
      fallbackStrategy: 'history_only',
      useCacheIfAvailable: true,
      memoryProfiles: defaultMemoryProfiles,
    };

    const updatedSession: LlmSession = {
      ...s,
      // If primary engine changes, we sync the legacy top-level model pointer
      llmModel: field === 'primaryModel' ? value : s.llmModel,
      strategy: {
        ...currentStrategy,
        [field]: value,
      },
    };

    this.save.emit(updatedSession);
  }

  /**
   * Mutates a specific field inside a specific Memory Profile tab
   */
  updateProfileStrategy(
    profileId: string,
    field: keyof MemoryStrategyProfile,
    value: any,
  ) {
    const currentProfiles = this.activeProfiles();
    const updatedProfiles = currentProfiles.map((p) =>
      p.id === profileId ? { ...p, [field]: value } : p,
    );
    this.updateStrategy('memoryProfiles', updatedProfiles);
  }

  /**
   * Handles the radio toggle between "Flick Back" (1 turn) and "Alert" (n turns).
   */
  onOverrideStrategyChange(type: 'flick' | 'alert') {
    const limit = type === 'flick' ? 1 : 2;
    this.updateStrategy('secondaryModelLimit', limit);
  }

  /**
   * Updates the numeric alert threshold, enforcing a minimum of 2.
   */
  onLimitChange(event: Event) {
    const target = event.target as HTMLSelectElement | HTMLInputElement;
    const val = parseInt(target.value, 10);
    if (!isNaN(val) && val >= 2) {
      this.updateStrategy('secondaryModelLimit', val);
    }
  }

  /**
   * Triggers context compilation using the Primary Model defined in the strategy.
   */
  async onCompileRequest(event: { intent: WorkspaceAttachment; ttl?: number }) {
    const s = this.session();
    if (!s) return;

    const model = s.strategy?.primaryModel || s.llmModel;
    const sources = await this.resolver.resolve(event.intent);

    await this.cacheService.compileCache({
      sources,
      model: model,
      ttlHours: event.ttl,
    });
  }

  async onAttachTrigger(
    targetBucket: 'inlineContexts' | 'systemContexts' | 'compiledContext',
  ) {
    const s = this.session();
    if (!s) return;

    const dialogRef = this.dialog.open<
      ContextPickerDialogComponent,
      any,
      ContextPickerResult
    >(ContextPickerDialogComponent, { width: '600px' });

    const result = await dialogRef.afterClosed().toPromise();
    if (result) {
      await this.sessionActions.attachContext(
        s.id,
        result.id,
        result.type,
        targetBucket,
      );
    }
  }

  async removeAttachment(
    id: URN,
    bucket: 'inlineContexts' | 'systemContexts' | 'compiledContext',
  ) {
    const s = this.session();
    if (s) {
      await this.sessionActions.removeContext(s.id, id, bucket);
    }
  }

  onTitleInput(event: Event): void {
    this.editTitleValue.set((event.target as HTMLInputElement).value);
  }

  startTitleEdit(): void {
    this.editTitleValue.set(this.session()?.title || '');
    this.isEditingTitle.set(true);
  }

  saveTitle(): void {
    const s = this.session();
    const newTitle = this.editTitleValue().trim();
    if (newTitle && s) {
      this.save.emit({ ...s, title: newTitle });
    }
    this.isEditingTitle.set(false);
  }

  toggleSessionProperty(field: keyof LlmSession, value: any) {
    const s = this.session();
    if (s) {
      this.save.emit({ ...s, [field]: value });
    }
  }

  onDelete(): void {
    this.delete.emit();
  }
}
