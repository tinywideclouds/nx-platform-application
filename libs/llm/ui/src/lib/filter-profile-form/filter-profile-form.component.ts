import {
  Component,
  input,
  output,
  signal,
  effect,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { ENTER, COMMA } from '@angular/cdk/keycodes';
import {
  FilterProfile,
  ProfileRequest,
} from '@nx-platform-application/llm-types';
import { YamlRulesService } from '@nx-platform-application/llm-features-data-sources';

@Component({
  selector: 'llm-filter-profile-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './filter-profile-form.component.html',
  styleUrl: './filter-profile-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmFilterProfileFormComponent {
  private yamlParser = inject(YamlRulesService);

  // Inputs
  activeProfile = input<FilterProfile | null>(null);
  isEditing = input<boolean>(false);
  isSaving = input<boolean>(false);

  // Outputs
  save = output<ProfileRequest>();
  cancel = output<void>();
  editRequested = output<string>();
  deleteRequested = output<string>();

  // Local Transient State
  draftName = signal<string>('');
  draftIncludes = signal<string[]>([]);
  draftExcludes = signal<string[]>([]);

  readonly separatorKeysCodes = [ENTER, COMMA] as const;

  constructor() {
    effect(() => {
      const profile = this.activeProfile();
      const editing = this.isEditing();

      if (editing) {
        this.draftName.set(profile?.name || '');

        const yaml =
          profile?.rulesYaml ||
          'include:\n  - "**/*"\nexclude:\n  - "node_modules/**"';
        const parsed = this.yamlParser.parse(yaml);

        this.draftIncludes.set(parsed.include);
        this.draftExcludes.set(parsed.exclude);
      }
    });
  }

  // --- Chip Interaction Logic ---

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

  // --- Actions ---

  onSave() {
    if (!this.draftName()) return;

    // Convert the arrays back into YAML for the backend payload
    const finalYaml = this.yamlParser.stringify({
      include: this.draftIncludes(),
      exclude: this.draftExcludes(),
    });

    this.save.emit({
      name: this.draftName(),
      rulesYaml: finalYaml,
    });
  }

  onCancel() {
    this.cancel.emit();
  }

  onEdit() {
    const profile = this.activeProfile();
    if (profile) this.editRequested.emit(profile.id);
  }

  onDelete() {
    const profile = this.activeProfile();
    if (profile) this.deleteRequested.emit(profile.id);
  }
}
