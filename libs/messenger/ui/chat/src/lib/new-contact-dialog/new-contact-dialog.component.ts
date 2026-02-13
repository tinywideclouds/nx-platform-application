import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'messenger-new-contact-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="p-6">
      <h2 class="text-xl font-bold mb-2">Start New Chat</h2>
      <p class="text-sm text-gray-500 mb-6">
        You are starting a chat with
        <strong class="text-gray-900">{{ data.email }}</strong
        >. <br />How should they appear in your list?
      </p>

      <mat-form-field appearance="outline" class="w-full">
        <mat-label>Alias (Name)</mat-label>
        <input
          matInput
          #aliasInput
          [value]="initialAlias()"
          (input)="alias.set(aliasInput.value)"
          (keyup.enter)="isValid() && onConfirm()"
          autoFocus
        />
      </mat-form-field>

      <div class="flex justify-end gap-2 mt-4">
        <button mat-button mat-dialog-close>Cancel</button>
        <button
          mat-flat-button
          color="primary"
          [disabled]="!isValid()"
          (click)="onConfirm()"
        >
          Start Chat
        </button>
      </div>
    </div>
  `,
})
export class NewContactDialogComponent {
  readonly data = inject(MAT_DIALOG_DATA) as { email: string };
  private readonly dialogRef = inject(MatDialogRef<NewContactDialogComponent>);

  // Signal State
  readonly initialAlias = signal(this.data.email.split('@')[0]);
  readonly alias = signal(this.initialAlias());

  readonly isValid = computed(() => this.alias().trim().length > 0);

  onConfirm() {
    if (this.isValid()) {
      this.dialogRef.close(this.alias().trim());
    }
  }
}
