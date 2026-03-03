import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  signal,
  effect,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

// LAYOUT & UI
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';

// DOMAIN
import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-conversation';
import { LlmSession } from '@nx-platform-application/llm-types';

// FEATURE COMPONENTS
import { LlmSessionSidebarComponent } from '../session-sidebar/session-sidebar.component';
import { LlmChatWindowComponent } from '../chat-window/chat-window.component';
import { LlmSessionPageComponent } from '../session-page/session-page.component';
import { LlmSessionWorkspaceComponent } from '../session-workspace/session-workspace.component';

@Component({
  selector: 'llm-chat-viewer',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MasterDetailLayoutComponent,
    LlmSessionSidebarComponent,
    LlmSessionPageComponent,
    LlmSessionWorkspaceComponent,
    LlmChatWindowComponent,
  ],
  templateUrl: './chat-viewer.component.html',
  styleUrl: './chat-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmChatViewerComponent {
  private router = inject(Router);
  private sessionSource = inject(LlmSessionSource);
  private sessionActions = inject(LlmSessionActions);
  private scrollSource = inject(LlmScrollSource);

  // ROUTER INPUTS
  readonly sessionId = input<string | undefined>(undefined);
  readonly viewMode = input<string | undefined>(undefined, { alias: 'view' });

  // UI State
  isMobile = signal(false);

  showDetail = computed(() => !!this.activeSession());

  // Reactive Session Metadata
  readonly activeSession = computed(() => {
    const id = this.sessionId();
    if (!id) return null;
    return (
      this.sessionSource.sessions().find((s) => s.id.toString() === id) || null
    );
  });

  constructor() {
    effect(() => {
      const currentId = this.sessionId();

      if (currentId) {
        // 1. WE HAVE AN ID IN THE URL.
        const session = this.activeSession();
        if (session) {
          untracked(() => {
            this.scrollSource.setSession(session.id);
          });
        }
      } else {
        // 2. NO ID IN THE URL (Base /chat route).
        // Now it is safe to auto-resume the latest chat if available.
        const allSessions = this.sessionSource.sessions();
        if (allSessions.length > 0) {
          untracked(() => {
            if (!this.isMobile()) {
              this.resumeLastSession(allSessions);
            }
          });
        }
      }
    });
  }

  // --- ROUTING ACTIONS ---

  resumeLastSession(sessions: LlmSession[]): void {
    if (!sessions || sessions.length === 0) return;

    // Assuming sessionSource keeps them sorted newest-first
    const lastSession = sessions[0];

    this.router.navigate(['/chat', lastSession.id.toString()], {
      queryParamsHandling: 'preserve', // Preserves ?view=workspace if someone hard reloads on it
    });
  }

  navigateToNew(): void {
    // Clears the URL to drop into the empty state (or trigger a new session creation)
    this.router.navigate(['/chat'], {
      queryParamsHandling: 'preserve',
    });
  }

  // --- UI ACTIONS ---

  clearSelection(): void {
    this.navigateToNew();
  }

  closeModalView(): void {
    this.router.navigate([], {
      queryParams: { view: null, proposal: null },
      queryParamsHandling: 'merge',
    });
  }
}
