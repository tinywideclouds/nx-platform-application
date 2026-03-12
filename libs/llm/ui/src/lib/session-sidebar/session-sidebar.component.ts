import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { URN } from '@nx-platform-application/platform-types';

// Domain & Feature Layers
import { LlmScrollSource } from '@nx-platform-application/llm-features-chat';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';
import {
  LlmCreateSessionDialogComponent,
  CreateSessionResult,
} from '../session-create-dialog/session-create.dialog';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'llm-session-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    DatePipe,
  ],
  templateUrl: './session-sidebar.component.html',
  styleUrl: './session-sidebar.component.scss',
})
export class LlmSessionSidebarComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  // --- Sources (Read-Only State) ---
  protected sessionSource = inject(LlmSessionSource);
  protected scrollSource = inject(LlmScrollSource);

  // --- Actions (Intent Orchestration) ---
  private actions = inject(LlmSessionActions);

  // --- State ---
  readonly activeSessionId = this.scrollSource.activeSessionId;
  readonly query = signal('');

  // --- Computed ---
  // Filters sessions locally based on the search input
  readonly filteredSessions = computed(() => {
    const q = this.query().toLowerCase().trim();
    const all = this.sessionSource.sessions();

    if (!q) return all;

    // Now searches by the friendly title FIRST, falling back to ID
    return all.filter(
      (session) =>
        (session.title || '').toLowerCase().includes(q) ||
        session.id.toString().toLowerCase().includes(q),
    );
  });

  // --- Event Handlers ---
  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.query.set(val);
  }

  onCreateNew(): void {
    const dialogRef = this.dialog.open(LlmCreateSessionDialogComponent, {
      width: '450px',
    });

    dialogRef
      .afterClosed()
      .subscribe((result: CreateSessionResult | undefined) => {
        if (result) {
          // Pass the title and the user's chosen destination route
          this.actions.createNewSession(result.title, result.action);
        }
      });
  }

  onOpenSession(id: URN): void {
    this.actions.openSession(id);
  }
}
