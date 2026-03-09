import { Component, computed, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { LlmSession } from '@nx-platform-application/llm-types';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';

import { LlmSessionFormComponent } from '../session-form/session-form.component';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  LlmDeleteSessionDialogComponent,
  DeleteSessionResult,
} from '../delete-session-dialog/delete-session-dialog.component';
import { LlmSessionSubpageHeaderComponent } from '../session-subpage-header/session-subpage-header.component';

@Component({
  selector: 'llm-session-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    LlmSessionFormComponent,
    LlmSessionSubpageHeaderComponent,
  ],
  templateUrl: './session-page.component.html',
  styleUrl: './session-page.component.scss',
})
export class LlmSessionPageComponent {
  private sessionSource = inject(LlmSessionSource);
  private sessionActions = inject(LlmSessionActions);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);

  readonly session = computed(() => this.sessionSource.activeSession());

  closed = output<void>();

  onClose(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: null },
      queryParamsHandling: 'merge',
    });
  }

  async onSave(updatedSession: LlmSession): Promise<void> {
    await this.sessionActions.updateSession(updatedSession);

    this.snackBar.open('Session settings updated', 'Close', {
      duration: 2000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  async onDelete(): Promise<void> {
    const currentSession = this.session();
    if (!currentSession) return;

    const dialogRef = this.dialog.open(LlmDeleteSessionDialogComponent, {
      width: '500px',
      data: { session: currentSession },
    });

    dialogRef
      .afterClosed()
      .subscribe(async (result: DeleteSessionResult | undefined) => {
        if (result?.confirmed) {
          try {
            await this.sessionActions.deleteSession(currentSession.id);

            this.snackBar.open('Session deleted', 'Close', { duration: 2000 });
            this.onClose();
          } catch (e) {
            console.error('Failed to delete session', e);
            this.snackBar.open('Failed to delete session', 'Close', {
              duration: 3000,
            });
          }
        }
      });
  }
}
