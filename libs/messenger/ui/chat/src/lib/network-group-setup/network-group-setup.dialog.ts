import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import {
  ReactiveFormsModule,
  FormControl,
  Validators,
  FormsModule,
} from '@angular/forms';

export interface NetworkGroupSetupData {
  defaultName: string;
  memberCount: number;
}

@Component({
  selector: 'messenger-network-group-setup-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  template: `
    <div class="p-6 max-w-md bg-white rounded-lg">
      <h2 class="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
        <mat-icon class="text-purple-600">hub</mat-icon>
        Setup Network Group
      </h2>

      <p class="text-gray-600 mb-6 text-sm">
        You are creating a <strong>new shared conversation</strong> based on
        this list.
      </p>

      <mat-form-field appearance="outline" class="w-full mb-2">
        <mat-label>Group Name</mat-label>
        <input
          matInput
          [formControl]="nameControl"
          placeholder="e.g. Summer Trip 2024"
          autofocus
        />
        <mat-error *ngIf="nameControl.hasError('required')">
          Name is required
        </mat-error>
      </mat-form-field>

      <div class="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
        <div class="flex items-start gap-3">
          <mat-icon class="text-blue-600 mt-0.5 text-sm">info</mat-icon>
          <div class="text-xs text-blue-800">
            <p class="font-bold mb-1">What happens next?</p>
            <ul class="list-disc pl-4 space-y-1">
              <li>A new group will be created on the server.</li>
              <li>
                <strong>{{ data.memberCount }} members</strong> will receive an
                invite.
              </li>
              <li>You will be redirected to the new chat immediately.</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <button mat-button (click)="dialogRef.close()">Cancel</button>
        <button
          mat-flat-button
          color="primary"
          [disabled]="nameControl.invalid"
          (click)="onConfirm()"
        >
          Create & Invite
        </button>
      </div>
    </div>
  `,
})
export class NetworkGroupSetupDialog {
  readonly dialogRef = inject(MatDialogRef<NetworkGroupSetupDialog>);
  readonly data = inject<NetworkGroupSetupData>(MAT_DIALOG_DATA);

  nameControl = new FormControl(this.data.defaultName, {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });

  onConfirm() {
    if (this.nameControl.valid) {
      this.dialogRef.close(this.nameControl.value);
    }
  }
}
