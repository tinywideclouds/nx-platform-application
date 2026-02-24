import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { URN } from '@nx-platform-application/platform-types';
import { LlmSessionSource } from 'libs/llm/features/chat/src/lib/llm-session.source';

@Injectable({ providedIn: 'root' })
export class LlmSessionActions {
  private router = inject(Router);
  private source = inject(LlmSessionSource);

  /**
   * Generates a new Session URN and navigates the user to the chat view.
   * Note: This does NOT save an empty session to the DB. The session will
   * be persisted automatically when the user sends their first message.
   */
  createNewSession(): void {
    const newId = URN.create('session', crypto.randomUUID(), 'llm');

    // 1. Update the Source immediately (Optimistic UI)
    this.source.addOptimisticSession(newId);

    // 2. Navigate
    this.router.navigate(['/chat', newId.toString()], {
      queryParams: { view: 'details' },
    });
  }

  /**
   * Switches the active session.
   */
  openSession(sessionId: URN): void {
    this.router.navigate(['/chat', sessionId.toString()], {
      queryParams: { view: null },
    });
  }
}
