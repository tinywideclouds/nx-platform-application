import {
  Component,
  inject,
  input,
  output,
  signal,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { URN } from '@nx-platform-application/platform-types';
import { LlmSession } from '@nx-platform-application/llm-types';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';

import { LlmSessionFormComponent } from '../session-form/session-form.component';

@Component({
  selector: 'llm-session-page',
  standalone: true,
  imports: [
    CommonModule,
    LlmSessionFormComponent,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './session-page.component.html',
})
export class LlmSessionPageComponent {
  private storage = inject(LlmStorageService);
  private sessionSource = inject(LlmSessionSource);
  private snackBar = inject(MatSnackBar);

  @ViewChild(LlmSessionFormComponent) formComponent!: LlmSessionFormComponent;

  // The URN passed from the overarching layout component
  sessionId = input.required<string>();

  closed = output<void>();

  isEditMode = signal(false);
  formErrorCount = signal(0);

  session = signal<LlmSession | null>(null);

  constructor() {
    // Reactively fetch session from storage when ID changes
    effect(async () => {
      const id = this.sessionId();
      if (!id) return;

      try {
        const urn = URN.parse(id);
        const sessions = await this.storage.getSessions();
        const found = sessions.find((s) => s.id.toString() === urn.toString());
        this.session.set(found || null);
      } catch (e) {
        console.error('Failed to load session details', e);
      }
    });
  }

  enableEditMode(): void {
    this.isEditMode.set(true);
  }

  triggerFormSave(): void {
    if (this.formComponent) {
      this.formComponent.triggerSave();
    }
  }

  onCancel(): void {
    // If we wanted to route back to chat, we'd emit here.
    // For now, just drop out of edit mode.
    this.isEditMode.set(false);
  }

  async onSave(updatedSession: LlmSession): Promise<void> {
    await this.storage.saveSession(updatedSession);
    this.sessionSource.refresh(); // Tell the sidebar to update the title

    this.session.set(updatedSession);
    this.isEditMode.set(false);

    this.snackBar.open('Session settings saved', 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  async onDelete(): Promise<void> {
    // We would typically plug in the ConfirmationDialogComponent here
    // exactly like contact-page.component.ts does before executing deletion.
    console.log(
      'Delete intent fired for session',
      this.session()?.id.toString(),
    );
  }

  onClose(): void {
    this.closed.emit();
  }
}
