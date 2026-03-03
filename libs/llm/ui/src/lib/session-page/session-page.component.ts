import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { URN } from '@nx-platform-application/platform-types';
import { LlmSession } from '@nx-platform-application/llm-types';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';

import { LlmSessionFormComponent } from '../session-form/session-form.component';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-conversation';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  LlmDeleteSessionDialogComponent,
  DeleteSessionResult,
} from '../delete-session-dialog/delete-session-dialog.component';

@Component({
  selector: 'llm-session-page',
  standalone: true,
  imports: [
    CommonModule,
    LlmSessionFormComponent,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './session-page.component.html',
  styleUrl: './session-page.component.scss',
})
export class LlmSessionPageComponent {
  private storage = inject(LlmStorageService);
  private sessionSource = inject(LlmSessionSource);
  private sessionActions = inject(LlmSessionActions);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  session = input<LlmSession | undefined>();

  closed = output<void>();

  // Create a computed signal bound to the global tracker
  isCompiling = computed(() => {
    const s = this.session();
    return s ? this.sessionActions.isCompiling(s.id.toString())() : false;
  });

  onClose(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: null },
      queryParamsHandling: 'merge',
    });
  }

  async onSave(updatedSession: LlmSession): Promise<void> {
    // Because the form emitted this on blur or addition, we just save it instantly
    await this.storage.saveSession(updatedSession);
    this.sessionSource.refresh();

    //TODO check local session is updated here

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
            // TODO: In the future, pass result.clearProposals and result.clearCache
            // to a dedicated sessionActions.deleteSession() method to handle the heavy lifting.

            await this.storage.deleteSession(currentSession.id);
            this.sessionSource.refresh();

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

  // The button click is now strictly "fire and forget"
  onCompileCache(): void {
    const currentSession = this.session();
    if (currentSession) {
      // Don't await it! Let it run in the background.
      this.sessionActions.compileSessionCache(currentSession);
    }
  }
}
