import { Injectable, inject, signal } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { CompiledCacheStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  CompiledCache,
  SessionAttachment,
} from '@nx-platform-application/llm-types';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface CompileCachePayload {
  sources: { dataSourceId: URN; profileId?: URN }[];
  model?: string;
  ttlHours?: number;
}

@Injectable({ providedIn: 'root' })
export class CompiledCacheService {
  private logger = inject(Logger);
  private network = inject(LLM_NETWORK_CLIENT);
  private cacheStorage = inject(CompiledCacheStorageService);
  private snackBar = inject(MatSnackBar);

  readonly isCompiling = signal<boolean>(false);

  async compileCache(
    payload: CompileCachePayload,
  ): Promise<CompiledCache | undefined> {
    if (payload.sources.length === 0) return undefined;

    this.isCompiling.set(true);

    try {
      const expiresAtHint = payload.ttlHours
        ? (Temporal.Now.instant()
            .add({ hours: payload.ttlHours })
            .toString() as ISODateTimeString)
        : undefined;

      // Map our pure sources list into the Attachment schema the backend expects
      const mappedAttachments: SessionAttachment[] = payload.sources.map(
        (s) => ({
          id: URN.create('attachment', crypto.randomUUID(), 'llm'),
          dataSourceId: s.dataSourceId,
          profileId: s.profileId,
          target: 'inline-context',
        }),
      );

      // A Dummy Session ID is passed as this action is now globally decoupled
      // from any specific chat session in the backend.
      const response = await this.network.buildCache({
        sessionId: URN.create('session', 'global-cache-build', 'llm'),
        model: payload.model || 'gemini-2.5-pro',
        attachments: mappedAttachments,
        expiresAtHint: expiresAtHint,
      });

      const fallbackExpiry = Temporal.Now.instant()
        .add({ hours: 24 })
        .toString() as ISODateTimeString;

      const newCache: CompiledCache = {
        id: response.compiledCacheId,
        provider: 'gemini',
        createdAt: Temporal.Now.instant().toString() as ISODateTimeString,
        expiresAt: response.expiresAt || expiresAtHint || fallbackExpiry,
        sources: payload.sources,
      };

      await this.cacheStorage.saveCache(newCache);

      this.snackBar.open('Context cache compiled successfully!', 'Close', {
        duration: 3000,
      });
      return newCache;
    } catch (error) {
      this.logger.error('Failed to compile global cache', error);
      this.snackBar.open('Failed to compile context cache.', 'Close', {
        duration: 4000,
      });
      return undefined;
    } finally {
      this.isCompiling.set(false);
    }
  }

  async deleteCache(id: URN): Promise<void> {
    try {
      await this.cacheStorage.deleteCache(id);
      this.snackBar.open('Cache deleted', 'Close', { duration: 2000 });
    } catch (error) {
      this.logger.error('Failed to delete cache', error);
    }
  }
}
