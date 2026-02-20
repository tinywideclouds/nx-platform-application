import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';

export interface GroupContextDialogData {
  existingGroups: { urn: string; name: string }[];
}

export interface GroupContextDialogResult {
  newName?: string;
  urn?: string;
}

@Component({
  selector: 'llm-group-context-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
  ],
  templateUrl: './group-context-dialog.component.html',
})
export class GroupContextDialogComponent {
  data: GroupContextDialogData = inject(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<GroupContextDialogComponent>);

  mode = signal<'new' | 'existing'>(
    this.data.existingGroups.length > 0 ? 'existing' : 'new',
  );
  newName = signal('');
  selectedUrn = signal<string | null>(null);

  isValid = computed(() => {
    if (this.mode() === 'new') return this.newName().trim().length > 0;
    return this.selectedUrn() !== null;
  });

  onConfirm() {
    if (this.mode() === 'new') {
      this.dialogRef.close({ newName: this.newName().trim() });
    } else {
      this.dialogRef.close({ urn: this.selectedUrn() });
    }
  }
}
