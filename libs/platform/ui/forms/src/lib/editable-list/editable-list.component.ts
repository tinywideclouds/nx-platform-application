import {
  Component,
  ChangeDetectionStrategy,
  signal,
  model,
  input,
  computed,
  OnInit,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';

// MATERIAL
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';

// YOUR LIB IMPORTS ONLY
import { validate, computedError, ValidationSchema } from './../validators';

type RowStatus = 'unchanged' | 'modified' | 'new' | 'deleted';

interface RowState {
  id: string; // Unique key for tracking (avoids index issues)
  value: string; // Current value
  originalValue: string | null; // Null if it's a new item
  status: RowStatus;
}

@Component({
  selector: 'lib-editable-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatListModule,
    MatTooltipModule,
  ],
  templateUrl: './editable-list.component.html',
  styleUrl: './editable-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditableListComponent implements OnInit {
  // --- INPUTS ---
  label = input.required<string>();
  schema = input.required<ValidationSchema<any>>();
  readonly = input(false);

  // --- MODEL ---
  items = model<string[]>([]);

  // --- INTERNAL STATE (The Ghost Rows) ---
  rows = signal<RowState[]>([]);

  // --- EDITING STATE ---
  stagingValue = signal('');
  editingId = signal<string | null>(null); // Track by ID now, not index
  editingValue = signal('');

  // --- VALIDATION ---
  stagingError = computedError(this.schema, this.stagingValue);
  editingError = computedError(this.schema, this.editingValue);

  isStagingValid = computed(() => {
    return this.stagingValue().trim() !== '' && !this.stagingError();
  });

  isEditingValid = computed(() => {
    return this.editingValue().trim() !== '' && !this.editingError();
  });

  ngOnInit() {
    // Initialize Internal State from the Model ONCE
    // We treat the passed 'items' as the "Original Source of Truth"
    const initialRows: RowState[] = this.items().map((val) => ({
      id: this.generateId(),
      value: val,
      originalValue: val,
      status: 'unchanged',
    }));
    this.rows.set(initialRows);
  }

  // --- SYNC ENGINE ---
  // When Internal State changes, update the Output Model
  private syncModel() {
    const activeValues = this.rows()
      .filter((r) => r.status !== 'deleted')
      .map((r) => r.value);

    // Update parent model
    this.items.set(activeValues);
  }

  // --- ACTIONS ---

  add() {
    if (this.readonly()) return;

    if (this.isStagingValid()) {
      const newRow: RowState = {
        id: this.generateId(),
        value: this.stagingValue(),
        originalValue: null, // It's new
        status: 'new',
      };

      this.rows.update((current) => [...current, newRow]);
      this.syncModel();
      this.stagingValue.set('');
    }
  }

  remove(id: string) {
    if (this.readonly()) return;

    this.rows.update(
      (current) =>
        current
          .map((row) => {
            if (row.id !== id) return row;

            // If it was NEW (never saved to DB), delete it permanently
            if (row.status === 'new') {
              return null; // Will filter this out below
            }

            // Otherwise, mark as DELETED (Ghost Row)
            return { ...row, status: 'deleted' };
          })
          .filter((r): r is RowState => r !== null), // Filter out nulls
    );
    this.syncModel();
  }

  restore(id: string) {
    if (this.readonly()) return;

    this.rows.update((current) =>
      current.map((row) => {
        if (row.id !== id) return row;

        // Recalculate status based on value vs original
        let newStatus: RowStatus = 'unchanged';
        if (row.originalValue === null) newStatus = 'new';
        else if (row.value !== row.originalValue) newStatus = 'modified';

        return { ...row, status: newStatus };
      }),
    );
    this.syncModel();
  }

  startEdit(id: string, currentValue: string) {
    if (this.readonly()) return;
    this.editingId.set(id);
    this.editingValue.set(currentValue);
  }

  saveEdit() {
    const id = this.editingId();
    if (id && this.isEditingValid()) {
      this.rows.update((current) =>
        current.map((row) => {
          if (row.id !== id) return row;

          const newValue = this.editingValue();
          // Determine status
          let status: RowStatus = 'unchanged';
          if (row.originalValue === null) status = 'new';
          else if (newValue !== row.originalValue) status = 'modified';

          return { ...row, value: newValue, status };
        }),
      );
      this.syncModel();
      this.cancelEdit();
    }
  }

  cancelEdit() {
    this.editingId.set(null);
    this.editingValue.set('');
  }

  // --- EVENTS ---
  onStagingInput(event: Event) {
    this.stagingValue.set((event.target as HTMLInputElement).value);
  }

  onEditingInput(event: Event) {
    this.editingValue.set((event.target as HTMLInputElement).value);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
}
