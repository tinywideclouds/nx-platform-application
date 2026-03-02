import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface EditMessageData {
  content: string;
  role: 'user' | 'model';
}

@Component({
  selector: 'llm-edit-message-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title class="!text-lg font-bold border-b pb-2">
      Edit Message
    </h2>
    <mat-dialog-content class="!pt-4">
      <div
        class="mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider"
      >
        {{ data.role === 'user' ? 'Your Message' : 'AI Response' }}
      </div>
      <textarea
        [(ngModel)]="editedContent"
        class="w-full h-64 p-3 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
        placeholder="Message content..."
      ></textarea>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="!px-6 !pb-4">
      <button mat-button mat-dialog-close color="warn">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [mat-dialog-close]="editedContent"
      >
        Save Changes
      </button>
    </mat-dialog-actions>
  `,
})
export class LlmEditMessageDialogComponent {
  editedContent: string;

  constructor(
    public dialogRef: MatDialogRef<LlmEditMessageDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditMessageData,
  ) {
    this.editedContent = data.content;
  }
}
