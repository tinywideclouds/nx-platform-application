import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private router = inject(Router);
  private sessionSource = inject(LlmSessionSource);

  private hasBooted = false;

  /**
   * Executes the global application boot sequence.
   * Should be called exactly once by the root layout component.
   */
  executeBootSequence(): void {
    if (this.hasBooted) return;
    this.hasBooted = true;

    // Grab the initial URL before Angular's router starts rewriting things
    const currentUrl = window.location.pathname;

    // If the user is navigating to a specific session/page, let them through
    if (currentUrl !== '/' && currentUrl !== '/chat') {
      return;
    }

    // BASE APP STATE: Auto-resume the last session
    const sessions = this.sessionSource.sessions();

    // (Future Roadmap: Check for last active Workspace here instead!)
    if (sessions.length > 0) {
      const lastSession = sessions[0]; // Assuming your source sorts by lastModified
      this.router.navigate(['/chat', lastSession.id.toString()], {
        replaceUrl: true,
      });
    }
  }
}
