import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  effect,
  untracked,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

// LAYOUT & UI
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';

// DOMAIN
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmSession } from '@nx-platform-application/llm-types';

// FEATURE COMPONENTS
import { LlmSessionSidebarComponent } from '../session-sidebar/session-sidebar.component';
import { LlmChatWindowComponent } from '../chat-window/chat-window.component';
import { LlmSessionPageComponent } from '../session-page/session-page.component';
import { LlmSessionWorkspaceComponent } from '../session-workspace/session-workspace.component';
import { URN } from '@nx-platform-application/platform-types';

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
  protected sessionSource = inject(LlmSessionSource);

  // ROUTER INPUTS
  readonly sessionId = input<string | undefined>(undefined);
  readonly viewMode = input<string | undefined>(undefined, { alias: 'view' });

  // UI State
  isMobile = signal(false);
  showDetail = computed(() => !!this.sessionSource.activeSession());

  constructor() {
    effect(() => {
      const currentIdStr = this.sessionId();

      if (currentIdStr) {
        // 1. WE HAVE AN ID IN THE URL. Centralize it!
        untracked(() => {
          this.sessionSource.setActiveSession(URN.parse(currentIdStr));
        });
      } else {
        // 2. NO ID IN THE URL. Clear state and try to auto-resume.
        untracked(() => {
          this.sessionSource.setActiveSession(null);
          const allSessions = this.sessionSource.sessions();
          if (allSessions.length > 0 && !this.isMobile()) {
            this.resumeLastSession(allSessions);
          }
        });
      }
    });
  }

  resumeLastSession(sessions: LlmSession[]): void {
    if (!sessions || sessions.length === 0) return;
    const lastSession = sessions[0];
    this.router.navigate(['/chat', lastSession.id.toString()], {
      queryParamsHandling: 'preserve',
    });
  }

  navigateToNew(): void {
    this.router.navigate(['/chat'], {
      queryParamsHandling: 'preserve',
    });
  }

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
