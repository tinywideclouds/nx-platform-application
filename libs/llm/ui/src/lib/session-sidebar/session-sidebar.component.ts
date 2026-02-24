import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { URN } from '@nx-platform-application/platform-types';

// Domain & Feature Layers
import {
  LlmSessionSource,
  LlmScrollSource,
} from '@nx-platform-application/llm-features-chat';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-conversation';

@Component({
  selector: 'llm-session-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    DatePipe,
  ],
  templateUrl: './session-sidebar.component.html',
  styleUrl: './session-sidebar.component.scss',
})
export class LlmSessionSidebarComponent {
  private router = inject(Router);
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

    // Currently searching by ID, but future-proofed for when sessions have titles
    return all.filter((session) =>
      session.id.toString().toLowerCase().includes(q),
    );
  });

  // --- Event Handlers ---
  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.query.set(val);
  }

  onCreateNew(): void {
    this.actions.createNewSession();
  }

  onOpenSession(id: URN): void {
    this.actions.openSession(id);
  }
}
