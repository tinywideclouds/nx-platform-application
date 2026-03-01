import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { URN } from '@nx-platform-application/platform-types';
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

  async createNewSession(): Promise<void> {
    const newId = URN.create('session', crypto.randomUUID(), 'llm');
    this.source.addOptimisticSession(newId);
    await this.router.navigate(['/chat', newId.toString()]);
  }

  async openSession(id: URN): Promise<void> {
    await this.router.navigate(['/chat', id.toString()]);
  }

  async compileSessionCache(session: LlmSession): Promise<void> {
    const idStr = session.id.toString();
    const cacheAttachments = session.attachments
      .filter((a) => a.target === 'gemini-cache')
      .map((a) => ({
        id: a.id,
        cacheId: a.cacheId.toString(),
        profileId: a.profileId?.toString(),
      }));

    if (cacheAttachments.length === 0) return;

    this.compilingSet.update((set) => {
      const newSet = new Set(set);
      newSet.add(idStr);
      return newSet;
    });

    try {
      const response = await this.network.buildCache({
        sessionId: idStr,
        model: session.llmModel || 'gemini-2.5-pro',
        attachments: cacheAttachments,
      });

      const updatedSession: LlmSession = {
        ...session,
        geminiCache: response.geminiCacheId,
      };

      await this.storage.saveSession(updatedSession);
      this.source.refresh();

      this.snackBar.open('Context compiled successfully!', 'Close', {
        duration: 3000,
      });
    } catch (e) {
      this.logger.error('Failed to compile cache', e);
      this.snackBar.open('Compilation failed. Check settings.', 'Close', {
        duration: 5000,
      });
    } finally {
      this.compilingSet.update((set) => {
        const newSet = new Set(set);
        newSet.delete(idStr);
        return newSet;
      });
    }
  }

  // --- EPHEMERAL QUEUE ACTIONS ---

  async acceptProposal(session: LlmSession, proposalId: string): Promise<void> {
    try {
      // TODO (Virtual Workspace): Apply the patch to the local file state
      // and save the updated file to the primary database BEFORE clearing the queue!

      // Clear the LLM's ephemeral memory by completely removing the proposal
      await this.network.removeProposal(session.id.toString(), proposalId);

      this.snackBar.open(
        'Change successfully applied and proposal cleared.',
        'Close',
        { duration: 3000 },
      );
    } catch (e) {
      this.logger.error('Failed to accept proposal', e);
      this.snackBar.open('Failed to accept changes.', 'Close', {
        duration: 4000,
      });
      throw e;
    }
  }

  async rejectProposal(session: LlmSession, proposalId: string): Promise<void> {
    try {
      // Clear the LLM's ephemeral memory
      await this.network.removeProposal(session.id.toString(), proposalId);

      this.snackBar.open('Proposal rejected and cleared.', 'Close', {
        duration: 3000,
      });
    } catch (e) {
      this.logger.error('Failed to reject proposal', e);
      throw e;
    }
  }
}
