import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Temporal } from '@js-temporal/polyfill';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { LlmSession } from '@nx-platform-application/llm-types';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';

@Injectable({ providedIn: 'root' })
export class LlmSessionActions {
  private readonly logger = inject(Logger);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private source = inject(LlmSessionSource);
  private storage = inject(LlmStorageService);
  private network = inject(LLM_NETWORK_CLIENT);

  private compilingSet = signal<Set<string>>(new Set());

  isCompiling(sessionId: string) {
    return computed(() => this.compilingSet().has(sessionId));
  }

  async createNewSession(
    title: string,
    target: 'chat' | 'options',
    model: string = 'gemini-2.5-pro',
  ): Promise<void> {
    const newId = URN.create('session', crypto.randomUUID(), 'llm');
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    const newSession: LlmSession = {
      id: newId,
      title: title.trim() || 'Untitled Session',
      lastModified: now,
      attachments: [],
    };

    // Save directly to DB and refresh so the title is accurate immediately
    await this.storage.saveSession(newSession);
    await this.source.refresh();

    // Branch the routing based on the user's choice
    if (target === 'options') {
      await this.router.navigate(['/chat', newId.toString()], {
        queryParams: { view: 'details' },
      });
    } else {
      await this.router.navigate(['/chat', newId.toString()]);
    }
  }

  async openSession(id: URN): Promise<void> {
    await this.router.navigate(['/chat', id.toString()]);
  }

  async compileSessionCache(session: LlmSession): Promise<void> {
    const idStr = session.id.toString();

    // 1. Get the raw Domain Attachments (perfect SessionAttachment[])
    const sessionCacheAttachments = session.attachments.filter(
      (a) => a.target === 'compiled-cache',
    );

    if (sessionCacheAttachments.length === 0) return;

    this.compilingSet.update((set) => {
      const newSet = new Set(set);
      newSet.add(session.id.toString());
      return newSet;
    });

    try {
      const response = await this.network.buildCache({
        sessionId: session.id,
        model: session.llmModel || 'gemini-2.5-pro',
        attachments: sessionCacheAttachments, // Direct pass!
        expiresAtHint: Temporal.Now.instant()
          .add({ hours: 4 })
          .toString() as ISODateTimeString,
      });

      const updatedSession: LlmSession = {
        ...session,
        compiledCache: {
          id: response.compiledCacheId, // Direct assignment!
          expiresAt: response.expiresAt,
          attachmentsUsed: sessionCacheAttachments, // Direct assignment!
        },
      };

      await this.storage.saveSession(updatedSession);
      this.source.refresh();

      this.snackBar.open('Context compiled successfully!', 'Close', {
        duration: 3000,
      });
    } catch (e) {
      this.logger.error('Failed to compile cache', e);
      this.snackBar.open('Failed to compile context cache.', 'Close', {
        duration: 4000,
      });
    } finally {
      this.compilingSet.update((set) => {
        const newSet = new Set(set);
        newSet.delete(idStr);
        return newSet;
      });
    }
  }

  async setWorkspaceTarget(sessionId: URN, targetId: URN): Promise<void> {
    try {
      const session = await this.storage.getSession(sessionId);
      if (session) {
        const updatedSession: LlmSession = {
          ...session,
          workspaceTarget: targetId,
        };
        await this.storage.saveSession(updatedSession);
        this.source.refresh();
      }
    } catch (e) {
      this.logger.error('Failed to save workspace target', e);
    }
  }
}
