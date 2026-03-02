import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

export interface CreateSessionResult {
  title: string;
  action: 'chat' | 'options';
}

@Component({
  selector: 'llm-create-session-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  template: `
    <h2 mat-dialog-title class="!text-lg font-bold border-b pb-2">
      New Conversation
    </h2>
    <mat-dialog-content class="!pt-4">
      <p class="mb-4 text-sm text-gray-600">
        Give your new session a name to easily find it later.
      </p>
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>Session Title</mat-label>
        <input
          matInput
          [(ngModel)]="title"
          placeholder="e.g., Auth Refactor"
          autofocus
          (keyup.enter)="close('chat')"
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="!px-6 !pb-4 flex gap-2 w-full">
      <button mat-button (click)="close(null)">Cancel</button>
      <div class="flex-grow"></div>
      <button mat-stroked-button color="primary" (click)="close('options')">
        Session Options
      </button>
      <button mat-flat-button color="primary" (click)="close('chat')">
        Start Chat
      </button>
    </mat-dialog-actions>
  `,
})
export class LlmCreateSessionDialogComponent {
  title = '';

  constructor(
    public dialogRef: MatDialogRef<LlmCreateSessionDialogComponent>,
  ) {}

  close(action: 'chat' | 'options' | null) {
    if (!action) {
      this.dialogRef.close();
      return;
    }
    this.dialogRef.close({ title: this.title, action } as CreateSessionResult);
  }
}
