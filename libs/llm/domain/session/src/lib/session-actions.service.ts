import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Temporal } from '@js-temporal/polyfill';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import {
  LlmSession,
  QuickContextFile,
  WorkspaceAttachment,
} from '@nx-platform-application/llm-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { SessionStorageService } from '@nx-platform-application/llm-infrastructure-storage';

@Injectable({ providedIn: 'root' })
export class LlmSessionActions {
  private readonly logger = inject(Logger);
  private router = inject(Router);
  private source = inject(LlmSessionSource);
  private storage = inject(SessionStorageService);

  /**
   * Valid Google Resource Names for the SDK.
   * Note: The '-preview' suffix is required for backend calls.
   */
  public readonly defaultModel = 'gemini-3-flash-preview';
  public readonly defaultSecondaryModel = 'gemini-3.1-pro-preview';

  async createNewSession(
    title: string,
    target: 'chat' | 'options',
    model: string = this.defaultModel,
  ): Promise<void> {
    const newId = URN.create('session', crypto.randomUUID(), 'llm');
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    const newSession: LlmSession = {
      id: newId,
      title: title.trim(),
      llmModel: model, // Required full string for the backend
      lastModified: now,
      strategy: {
        primaryModel: model,
        secondaryModel: this.defaultSecondaryModel,
        secondaryModelLimit: 3,
        fallbackStrategy: 'inline',
        useCacheIfAvailable: true,
      },
      inlineContexts: [],
      systemContexts: [],
      compiledContext: undefined,
      quickContext: [],
    };

    await this.storage.saveSession(newSession);
    await this.source.refresh();

    const route = ['/chat', newId.toString()];
    if (target === 'options') {
      await this.router.navigate(route, { queryParams: { view: 'details' } });
    } else {
      await this.router.navigate(route);
    }
  }

  async openSession(id: URN): Promise<void> {
    await this.router.navigate(['/chat', id.toString()]);
  }

  async updateSession(session: LlmSession): Promise<void> {
    try {
      // Repair logic: Ensure legacy sessions get a valid strategy object
      if (!session.strategy) {
        session.strategy = {
          primaryModel: session.llmModel,
          secondaryModel: this.defaultSecondaryModel,
          secondaryModelLimit: 3,
          fallbackStrategy: 'inline',
          useCacheIfAvailable: true,
        };
      }
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

  // --- CONTEXT INTENT MANAGEMENT ---

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
        session.compiledContext = attachment;
      } else {
        session[targetBucket] = [...(session[targetBucket] || []), attachment];
      }

      await this.updateSession(session);
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

      await this.updateSession(session);
    } catch (e) {
      this.logger.error(`Failed to remove context from ${targetBucket}`, e);
    }
  }

  // --- WORKSPACE & QUICK CONTEXT ---

  async setWorkspaceTarget(sessionId: URN, targetId: URN): Promise<void> {
    try {
      const session = await this.storage.getSession(sessionId);
      if (session) {
        session.workspaceTarget = targetId;
        await this.updateSession(session);
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

      session.quickContext = combinedFiles.slice(0, 6);
      await this.updateSession(session);

      return droppedFile;
    } catch (e) {
      this.logger.error('Failed to add quick context file', e);
      return undefined;
    }
  }

  async removeQuickFile(sessionId: URN, fileId: URN): Promise<void> {
    try {
      const session = await this.storage.getSession(sessionId);
      if (!session || !session.quickContext) return;

      session.quickContext = session.quickContext.filter(
        (f) => !f.id.equals(fileId),
      );

      await this.updateSession(session);
    } catch (e) {
      this.logger.error('Failed to remove quick context file', e);
    }
  }
}
