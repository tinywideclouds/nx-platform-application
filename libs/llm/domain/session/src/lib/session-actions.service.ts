import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Temporal } from '@js-temporal/polyfill';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';
import {
  LlmSession,
  QuickContextFile,
  WorkspaceAttachment,
} from '@nx-platform-application/llm-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { SessionStorageService } from '@nx-platform-application/llm-infrastructure-storage';

const defaultModel = 'gemini-2.5-pro';

@Injectable({ providedIn: 'root' })
export class LlmSessionActions {
  private readonly logger = inject(Logger);
  private router = inject(Router);
  private source = inject(LlmSessionSource);
  private storage = inject(SessionStorageService);

  async createNewSession(
    title: string,
    target: 'chat' | 'options',
    model: string = defaultModel,
  ): Promise<void> {
    const newId = URN.create('session', crypto.randomUUID(), 'llm');
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    const newSession: LlmSession = {
      id: newId,
      title: title.trim(),
      llmModel: model,
      lastModified: now,
      // Initialize the explicit intent buckets
      inlineContexts: [],
      systemContexts: [],
      compiledContext: undefined,
      quickContext: [],
    };

    await this.storage.saveSession(newSession);
    await this.source.refresh();

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

  async updateSession(session: LlmSession): Promise<void> {
    try {
      await this.storage.saveSession(session);
      await this.source.refresh();
    } catch (e) {
      this.logger.error('Failed to update session', e);
      throw e;
    }
  }

  async deleteSession(id: URN): Promise<void> {
    try {
      await this.storage.deleteSession(id);
      await this.source.refresh();
    } catch (e) {
      this.logger.error('Failed to delete session', e);
      throw e;
    }
  }

  // --- NEW CONTEXT INTENT MANAGEMENT ---

  async attachContext(
    sessionId: URN,
    resourceUrn: URN,
    resourceType: 'source' | 'group',
    targetBucket: 'inlineContexts' | 'systemContexts' | 'compiledContext',
  ): Promise<void> {
    try {
      const session = await this.storage.getSession(sessionId);
      if (!session) return;

      const attachment: WorkspaceAttachment = {
        id: URN.create('attachment', crypto.randomUUID(), 'llm'),
        resourceUrn,
        resourceType,
      };

      if (targetBucket === 'compiledContext') {
        session.compiledContext = attachment; // Only 1 allowed
      } else {
        session[targetBucket] = [...(session[targetBucket] || []), attachment]; // Append to arrays
      }

      await this.storage.saveSession(session);
      await this.source.refresh();
    } catch (e) {
      this.logger.error(`Failed to attach context to ${targetBucket}`, e);
    }
  }

  async removeContext(
    sessionId: URN,
    attachmentId: URN,
    targetBucket: 'inlineContexts' | 'systemContexts' | 'compiledContext',
  ): Promise<void> {
    try {
      const session = await this.storage.getSession(sessionId);
      if (!session) return;

      if (targetBucket === 'compiledContext') {
        if (session.compiledContext?.id.equals(attachmentId)) {
          session.compiledContext = undefined;
        }
      } else {
        session[targetBucket] = (session[targetBucket] || []).filter(
          (a) => !a.id.equals(attachmentId),
        );
      }

      await this.storage.saveSession(session);
      await this.source.refresh();
    } catch (e) {
      this.logger.error(`Failed to remove context from ${targetBucket}`, e);
    }
  }

  // --- WORKSPACE & QUICK CONTEXT ---

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

  async addQuickFile(
    sessionId: URN,
    file: { name: string; content: string },
  ): Promise<QuickContextFile | undefined> {
    try {
      const session = await this.storage.getSession(sessionId);
      if (!session) return undefined;

      const newFile: QuickContextFile = {
        id: URN.create('quick-context', crypto.randomUUID(), 'llm'),
        name: file.name,
        content: file.content,
      };

      const currentFiles = session.quickContext || [];
      const filteredFiles = currentFiles.filter((f) => f.name !== file.name);

      const combinedFiles = [newFile, ...filteredFiles];

      let droppedFile: QuickContextFile | undefined = undefined;
      if (combinedFiles.length > 6) {
        droppedFile = combinedFiles[combinedFiles.length - 1];
      }

      const updatedQuickContext = combinedFiles.slice(0, 6);

      const updatedSession: LlmSession = {
        ...session,
        quickContext: updatedQuickContext,
      };

      await this.storage.saveSession(updatedSession);
      this.source.refresh();

      return droppedFile;
    } catch (e) {
      this.logger.error('Failed to add quick context file', e);
      return undefined;
    }
  }

  async removeQuickFile(sessionId: URN, fileId: URN): Promise<void> {
    // ... [No changes needed to quick context implementation] ...
    try {
      const session = await this.storage.getSession(sessionId);
      if (!session || !session.quickContext) return;

      const updatedQuickContext = session.quickContext.filter(
        (f) => !f.id.equals(fileId),
      );

      const updatedSession: LlmSession = {
        ...session,
        quickContext: updatedQuickContext,
      };

      await this.storage.saveSession(updatedSession);
      this.source.refresh();
    } catch (e) {
      this.logger.error('Failed to remove quick context file', e);
    }
  }
}
