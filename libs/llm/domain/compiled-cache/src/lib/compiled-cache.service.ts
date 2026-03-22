import { Injectable, inject, signal } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { CompiledCacheStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  CompiledCache,
  ContextAttachment,
} from '@nx-platform-application/llm-types';

export interface CompileCachePayload {
  sources: URN[]; // Flat array of DataSource Stream URNs
  model: string;
  ttlHours?: number;
}

@Injectable({ providedIn: 'root' })
export class CompiledCacheService {
  private logger = inject(Logger);
  private network = inject(LLM_NETWORK_CLIENT);
  private cacheStorage = inject(CompiledCacheStorageService);
  private snackBar = inject(MatSnackBar);

  // --- STATE ---
  private _activeCaches = signal<CompiledCache[]>([]);
  readonly activeCaches = this._activeCaches.asReadonly();
  readonly isCompiling = signal<boolean>(false);

  constructor() {
    this.refresh();
  }

  // --- QUERIES ---

  async refresh(): Promise<void> {
    try {
      const allCaches = await this.cacheStorage.getAllCaches();
      const now = Temporal.Now.instant();
      const validCaches: CompiledCache[] = [];

      for (const cache of allCaches) {
        const expiry = Temporal.Instant.from(cache.expiresAt);
        if (Temporal.Instant.compare(expiry, now) <= 0) {
          this.logger.info(`Purging expired cache: ${cache.id}`);
          await this.cacheStorage.deleteCache(cache.id);
        } else {
          validCaches.push(cache);
        }
      }

      this._activeCaches.set(validCaches);
    } catch (error) {
      this.logger.error('Failed to load compiled caches', error);
    }
  }

  /**
   * Helper to generate a deterministic string hash from an array of URNs.
   */
  private hashSources(sources: URN[]): string {
    return sources
      .map((s) => s.toString())
      .sort()
      .join('::');
  }

  getValidCache(
    requestedSources: URN[],
    model: string,
  ): CompiledCache | undefined {
    if (requestedSources.length === 0) return undefined;

    const now = Temporal.Now.instant();
    const caches = this._activeCaches();
    const requestedHash = this.hashSources(requestedSources);

    return caches.find((cache) => {
      if (cache.model !== model) return false;

      const cacheHash = this.hashSources(cache.sources);
      if (cacheHash !== requestedHash) return false;

      const expiry = Temporal.Instant.from(cache.expiresAt);
      return Temporal.Instant.compare(expiry, now) > 0;
    });
  }

  // --- ACTIONS ---

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

      // Note: Depending on your LLM_NETWORK_CLIENT's expected shape,
      // ContextAttachment may need updating to just hold the URN instead of dataSourceId/profileId.
      const mappedAttachments: ContextAttachment[] = payload.sources.map(
        (urn) => ({
          id: URN.create('attachment', crypto.randomUUID(), 'llm'),
          dataSourceId: urn,
        }),
      );

      const response = await this.network.buildCache({
        model: payload.model,
        attachments: mappedAttachments,
        expiresAtHint: expiresAtHint,
      });

      const newCache: CompiledCache = {
        id: response.compiledCacheId,
        model: payload.model,
        provider: 'gemini',
        createdAt: Temporal.Now.instant().toString() as ISODateTimeString,
        expiresAt: response.expiresAt,
        sources: payload.sources,
      };

      await this.cacheStorage.saveCache(newCache);
      await this.refresh();

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
      await this.refresh();
      this.snackBar.open('Cache deleted', 'Close', { duration: 2000 });
    } catch (error) {
      this.logger.error('Failed to delete cache', error);
    }
  }
}
