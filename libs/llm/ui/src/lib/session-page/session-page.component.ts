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
  styleUrl: './session-page.component.scss',
})
export class LlmSessionPageComponent {
  private storage = inject(LlmStorageService);
  private sessionSource = inject(LlmSessionSource);
  private sessionActions = inject(LlmSessionActions);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  sessionId = input<string | undefined>();

  closed = output<void>();

  // Create a computed signal bound to the global tracker
  isCompiling = computed(() => {
    const s = this.session();
    return s ? this.sessionActions.isCompiling(s.id.toString())() : false;
  });
  session = signal<LlmSession | null>(null);

  constructor() {
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
    this.sessionSource.refresh(); // Sidebar updates immediately!

    this.session.set(updatedSession);

    this.snackBar.open('Session settings updated', 'Close', {
      duration: 2000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  async onDelete(): Promise<void> {
    const id = this.sessionId();
    if (!id) return;
    try {
      await this.storage.deleteSession(URN.parse(id));
      this.sessionSource.refresh();
      this.onClose();
    } catch (e) {
      console.error('Failed to delete session', e);
    }
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
