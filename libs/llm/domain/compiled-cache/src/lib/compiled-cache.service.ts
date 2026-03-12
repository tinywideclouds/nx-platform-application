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
import { FilteredDataSource } from '@nx-platform-application/data-sources-types';

export interface CompileCachePayload {
  sources: FilteredDataSource[]; // THE PHYSICAL FILES (Unrolled by the Builder)
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

  /**
   * Reloads the active caches from IndexedDB and passively purges expired ones.
   */
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
   * Helper to generate a deterministic string hash from an array of sources.
   * This allows us to mathematically compare two source arrays regardless of order.
   */
  private hashSources(sources: FilteredDataSource[]): string {
    return sources
      .map(
        (s) =>
          `${s.dataSourceId.toString()}|${s.profileId?.toString() || 'none'}`,
      )
      .sort()
      .join('::');
  }

  /**
   * THE MAGIC LOOKUP: Checks if we already have a warm cache for this exact
   * combination of physical files and this specific LLM model.
   */
  getValidCache(
    requestedSources: FilteredDataSource[],
    model: string,
  ): CompiledCache | undefined {
    if (requestedSources.length === 0) return undefined;

    const now = Temporal.Now.instant();
    const caches = this._activeCaches();
    const requestedHash = this.hashSources(requestedSources);

    return caches.find((cache) => {
      // 1. Must match the exact LLM model
      if (cache.model !== model) return false;

      // 2. Must match the exact physical files
      const cacheHash = this.hashSources(cache.sources);
      if (cacheHash !== requestedHash) return false;

      // 3. Must not be expired
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

      // Map physical domain sources to network attachments
      const mappedAttachments: ContextAttachment[] = payload.sources.map(
        (s) => ({
          id: URN.create('attachment', crypto.randomUUID(), 'llm'),
          dataSourceId: s.dataSourceId,
          profileId: s.profileId,
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

      const savedURN = await this.cacheStorage.saveCache(newCache);

      console.log('got good response', response, savedURN);

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
