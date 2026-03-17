import {
  Component,
  ChangeDetectionStrategy,
  inject,
  effect,
  untracked,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { URN } from '@nx-platform-application/platform-types';
import { LlmSession } from '@nx-platform-application/llm-types';

import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
// The children it orchestrates
import { LlmChatViewerComponent } from '../chat-viewer/chat-viewer.component';
import { LlmChatHeaderComponent } from '../chat-header/chat-header.component';
import { LlmSessionPageComponent } from '../session-page/session-page.component';
import { LlmSessionWorkspaceComponent } from '../session-workspace/session-workspace.component';
import { LlmSessionMemoryComponent } from '../session-memory/session-memory.component';

@Component({
  selector: 'llm-chat-shell',
  standalone: true,
  imports: [
    CommonModule,
    LlmChatViewerComponent,
    LlmChatHeaderComponent,
    LlmSessionPageComponent,
    LlmSessionWorkspaceComponent,
    LlmSessionMemoryComponent,
  ],
  templateUrl: './chat-shell.component.html',
  styleUrl: './chat-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmChatShellComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // The shell is the only component that injects and mutates this source based on routing
  private sessionSource = inject(LlmSessionSource);

  // EXPOSE THE SIGNAL PUBLICLY FOR THE TEMPLATE
  readonly activeSession = this.sessionSource.activeSession;

  readonly sessionIdUrlParam = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('sessionId'))),
  );
  readonly viewMode = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('view'))),
    { initialValue: null },
  );

  private readonly validSubpages = ['details', 'workspace', 'memory'];
  readonly isSubpageOpen = computed(() => {
    const view = this.viewMode();
    return view ? this.validSubpages.includes(view) : false;
  });

  isMobile = signal(window.innerWidth < 768);

  protected hasInitialized = false;

  constructor() {
    effect(() => {
      const currentIdStr = this.sessionIdUrlParam();
      if (currentIdStr) {
        untracked(() =>
          this.sessionSource.setActiveSession(URN.parse(currentIdStr)),
        );
        this.hasInitialized = true; // Mark as initialized
      } else {
        untracked(() => {
          this.sessionSource.setActiveSession(null);
          const allSessions = this.sessionSource.sessions();

          // --- CHANGED: Only auto-resume on the very first load! ---
          if (
            !this.hasInitialized &&
            allSessions.length > 0 &&
            !this.isMobile()
          ) {
            this.resumeLastSession(allSessions);
          }

          this.hasInitialized = true;
        });
      }
    });
  }

  resumeLastSession(sessions: LlmSession[]): void {
    console.log('resuming session', this.hasInitialized);
    if (!sessions || sessions.length === 0) return;
    this.router.navigate(['/chat', sessions[0].id.toString()], {
      queryParamsHandling: 'preserve',
    });
  }

  closeSubpage(): void {
    this.router.navigate([], {
      queryParams: { view: null, proposal: null },
      queryParamsHandling: 'merge',
    });
  }

  switchSubpage(view: string): void {
    this.router.navigate([], {
      queryParams: { view: view },
      queryParamsHandling: 'merge',
    });
  }
}
