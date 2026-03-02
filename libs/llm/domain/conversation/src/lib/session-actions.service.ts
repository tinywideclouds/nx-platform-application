import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import {
  FileProposalType,
  LlmSession,
  SSEProposalEvent,
} from '@nx-platform-application/llm-types';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { Temporal } from '@js-temporal/polyfill';

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
      await this.updateLocalProposalStatus(session.id, proposalId, 'accepted');
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
      await this.updateLocalProposalStatus(session.id, proposalId, 'rejected');
      await this.network.removeProposal(session.id.toString(), proposalId);

      this.snackBar.open('Proposal rejected.', 'Close', { duration: 3000 });
    } catch (e) {
      this.logger.error('Failed to reject proposal', e);
      this.snackBar.open('Failed to reject proposal.', 'Close', {
        duration: 4000,
      });
      throw e;
    }
  }

  private async updateLocalProposalStatus(
    sessionId: URN,
    proposalId: string,
    newStatus: 'accepted' | 'rejected',
  ): Promise<void> {
    const messages = await this.storage.getSessionMessages(sessionId);
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    for (const msg of messages) {
      if (!msg.payloadBytes || !msg.typeId.equals(FileProposalType)) {
        continue;
      }

      const text = decoder.decode(msg.payloadBytes);
      try {
        const parsed = JSON.parse(text);

        // Backwards compatibility for old records that had the __type wrapper
        const payload =
          parsed.__type === 'workspace_proposal' ? parsed.data : parsed;
        const event = payload as SSEProposalEvent;

        if (event.proposal.id === proposalId) {
          event.proposal.status = newStatus;

          const newBytes = encoder.encode(JSON.stringify(event));
          await this.storage.saveMessage({ ...msg, payloadBytes: newBytes });

          break;
        }
      } catch (e) {
        this.logger.error('Failed to parse proposal for status update', e);
      }
    }
  }
}
