import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';

export interface BranchContextDialogResult {
  mode: 'copy' | 'move';
}

@Component({
  selector: 'llm-branch-context-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatRadioModule,
  ],
  templateUrl: './branch-context-dialog.component.html',
})
export class BranchContextDialogComponent {
  dialogRef = inject(MatDialogRef<BranchContextDialogComponent>);
  mode = signal<'copy' | 'move'>('copy');

  onConfirm() {
    this.dialogRef.close({ mode: this.mode() });
  }
}
