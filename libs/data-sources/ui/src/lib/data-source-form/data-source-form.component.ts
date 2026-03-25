import {
  Component,
  input,
  output,
  signal,
  effect,
  inject,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ENTER, COMMA } from '@angular/cdk/keycodes';

import {
  DataSource,
  DataSourceRequest,
} from '@nx-platform-application/data-sources-types';
import {
  YamlRulesService,
  DataSourcesService,
} from '@nx-platform-application/data-sources-features-state';
import { URN } from '@nx-platform-application/platform-types';

import { FileAnalysisSummaryComponent } from '../file-analysis-summary/file-analysis-summary.component';

@Component({
  selector: 'data-source-form',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    FileAnalysisSummaryComponent,
  ],
  templateUrl: './data-source-form.component.html',
  styleUrl: './data-source-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourceFormComponent {
  private yamlParser = inject(YamlRulesService);
  state = inject(DataSourcesService);

  // Inputs
  activeSource = input<DataSource | null>(null);
  isEditing = input<boolean>(false);
  isSaving = input<boolean>(false);

  // Outputs
  save = output<{ targetId: URN; payload: DataSourceRequest }>();
  cancel = output<void>();
  editRequested = output<URN>();
  deleteRequested = output<URN>();

  // Local Transient State
  draftTargetId = signal<URN | null>(null);
  draftName = signal<string>('');
  draftDescription = signal<string>(''); // FIXED: Added description signal
  draftIncludes = signal<string[]>([]);
  draftExcludes = signal<string[]>([]);

  readonly separatorKeysCodes = [ENTER, COMMA] as const;

  activeTargetDetails = computed(() => {
    const source = this.activeSource();
    if (!source) return null;
    return (
      this.state.githubTargets().find((t) => t.id.equals(source.targetId)) ||
      null
    );
  });

  selectedTargetDetails = computed(() => {
    const draftId = this.draftTargetId();
    if (!draftId) return null;
    return this.state.githubTargets().find((t) => t.id.equals(draftId)) || null;
  });

  constructor() {
    effect(() => {
      const source = this.activeSource();
      const editing = this.isEditing();

      if (editing) {
        this.draftName.set(source?.name || '');
        this.draftDescription.set(source?.description || ''); // FIXED: Hydrate description
        this.draftTargetId.set(source?.targetId || null);

        const yaml =
          source?.rulesYaml ||
          'include:\n  - "**/*"\nexclude:\n  - "node_modules/**"';
        const parsed = this.yamlParser.parse(yaml);

        this.draftIncludes.set(parsed.include);
        this.draftExcludes.set(parsed.exclude);
      }
    });
  }

  setTargetId(idStr: string) {
    this.draftTargetId.set(URN.parse(idStr));
  }

  addInclude(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value) this.draftIncludes.update((arr) => [...arr, value]);
    event.chipInput!.clear();
  }

  removeInclude(pattern: string): void {
    this.draftIncludes.update((arr) => arr.filter((p) => p !== pattern));
  }

  addExclude(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value) this.draftExcludes.update((arr) => [...arr, value]);
    event.chipInput!.clear();
  }

  removeExclude(pattern: string): void {
    this.draftExcludes.update((arr) => arr.filter((p) => p !== pattern));
  }

  onSave() {
    const targetId = this.draftTargetId();
    if (!this.draftName() || !targetId) return;

    const finalYaml = this.yamlParser.stringify({
      include: this.draftIncludes(),
      exclude: this.draftExcludes(),
    });

    this.save.emit({
      targetId,
      payload: {
        name: this.draftName(),
        description: this.draftDescription(),
        rulesYaml: finalYaml,
      },
    });
  }

  onCancel() {
    this.cancel.emit();
  }

  onEdit() {
    const source = this.activeSource();
    if (source) this.editRequested.emit(source.id);
  }

  onDelete() {
    const source = this.activeSource();
    if (source) this.deleteRequested.emit(source.id);
  }
}
