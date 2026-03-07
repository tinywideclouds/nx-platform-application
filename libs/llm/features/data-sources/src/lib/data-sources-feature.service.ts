import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LlmGithubFirestoreClient } from '@nx-platform-application/llm-infrastructure-github-firestore-access';
import {
  CacheBundle,
  FileMetadata,
  FilterProfile,
  FilterRules,
  ProfileRequest,
  SyncStreamEvent,
} from '@nx-platform-application/llm-types';
import { URN } from '@nx-platform-application/platform-types';

@Injectable({ providedIn: 'root' })
export class LlmDataSourcesStateService {
  private client = inject(LlmGithubFirestoreClient);
  private snackBar = inject(MatSnackBar);

  // --- STATE SIGNALS ---

  caches = signal<CacheBundle[]>([]);
  isCachesLoading = signal<boolean>(false);

  activeCacheId = signal<URN | null>(null);
  activeFiles = signal<FileMetadata[]>([]);
  activeProfiles = signal<FilterProfile[]>([]);
  isActiveCacheLoading = signal<boolean>(false);

  syncLogs = signal<SyncStreamEvent[]>([]);

  // --- COMPUTED STATE ---

  cachesById = computed(() => {
    const map = new Map<string, CacheBundle>();
    for (const cache of this.caches()) {
      map.set(cache.id.toString(), cache);
    }
    return map;
  });

  activeCache = computed(() => {
    const id = this.activeCacheId();
    if (!id) return null;
    return this.cachesById().get(id.toString()) || null;
  });

  groupedCaches = computed(() => {
    const list = this.caches();
    const groups: Record<string, CacheBundle[]> = {};

    for (const cache of list) {
      if (!groups[cache.repo]) groups[cache.repo] = [];
      groups[cache.repo].push(cache);
    }
    return groups;
  });

  // --- HELPERS ---

  private showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }

  clearSelection() {
    this.activeCacheId.set(null);
    this.activeFiles.set([]);
    this.activeProfiles.set([]);
  }

  // --- DATA LOADING ---

  async loadAllCaches(): Promise<void> {
    this.isCachesLoading.set(true);
    try {
      const data = await firstValueFrom(this.client.listCaches());
      this.caches.set(data);
    } catch (error) {
      console.error('Failed to load caches', error);
      this.showError('Failed to load repositories from the server.');
      this.caches.set([]);
    } finally {
      this.isCachesLoading.set(false);
    }
  }

  async loadFilesForCache(cacheId: URN): Promise<void> {
    try {
      const files = await firstValueFrom(this.client.getFiles(cacheId));
      this.activeFiles.set(files);
    } catch (e) {
      console.error(`Failed to load files for cache ${cacheId.toString()}`, e);
      this.activeFiles.set([]);
      throw e;
    }
  }

  async selectCache(cacheId: URN): Promise<void> {
    this.activeCacheId.set(cacheId);
    this.isActiveCacheLoading.set(true);
    this.syncLogs.set([]);

    try {
      await Promise.all([
        this.loadFilesForCache(cacheId),
        firstValueFrom(this.client.listProfiles(cacheId)).then((p) =>
          this.activeProfiles.set(p),
        ),
      ]);
    } catch (e) {
      console.error('Failed to load cache details', e);
      this.showError('Failed to load repository details.');
      this.activeFiles.set([]);
      this.activeProfiles.set([]);
    } finally {
      this.isActiveCacheLoading.set(false);
    }
  }

  // --- REPOSITORY LIFECYCLE ACTIONS ---

  async createCache(payload: {
    repo: string;
    branch: string;
  }): Promise<URN | null> {
    try {
      this.snackBar.open(`Analyzing ${payload.repo}...`, '', {
        duration: 2000,
      });
      const newCache = await this.client.createCache(
        payload.repo,
        payload.branch,
      );

      this.caches.update((c) => [...c, newCache]);
      return newCache.id;
    } catch (error) {
      console.error('Failed to create cache skeleton', error);
      this.showError(`Failed to analyze repository ${payload.repo}.`);
      return null;
    }
  }

  executeSync(cacheId: URN, ingestionRules: FilterRules): Promise<void> {
    this.syncLogs.set([]);

    this.caches.update((caches) =>
      caches.map((c) =>
        c.id.equals(cacheId) ? { ...c, status: 'syncing' } : c,
      ),
    );

    return new Promise<void>((resolve, reject) => {
      this.client.executeSyncStream(cacheId, ingestionRules).subscribe({
        next: (event: SyncStreamEvent) => {
          this.syncLogs.update((logs) => [...logs, event]);
        },
        error: (error) => {
          this.caches.update((caches) =>
            caches.map((c) =>
              c.id.equals(cacheId) ? { ...c, status: 'failed' } : c,
            ),
          );
          console.error('Failed to execute sync stream', error);
          this.showError('Repository sync failed. Please try again.');
          reject(error);
        },
        complete: async () => {
          try {
            this.snackBar.open('Sync completed successfully.', 'Close', {
              duration: 3000,
            });

            await this.loadAllCaches();
            if (this.activeCacheId()?.equals(cacheId)) {
              await this.loadFilesForCache(cacheId);
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      });
    });
  }

  // --- FILTER PROFILES ---

  async saveProfile(req: ProfileRequest, profileId?: URN): Promise<void> {
    const cacheId = this.activeCacheId();
    if (!cacheId) {
      throw new Error('Cannot save a profile without an active cache ID.');
    }

    try {
      let savedProfile: FilterProfile;

      if (profileId) {
        savedProfile = await firstValueFrom(
          this.client.updateProfile(cacheId, profileId, req),
        );
      } else {
        savedProfile = await firstValueFrom(
          this.client.createProfile(cacheId, req),
        );
      }

      this.activeProfiles.update((profiles) => {
        const idx = profiles.findIndex((p) => p.id.equals(savedProfile.id));
        if (idx >= 0) {
          const updated = [...profiles];
          updated[idx] = savedProfile;
          return updated;
        }
        return [...profiles, savedProfile];
      });

      this.snackBar.open('Filter profile saved', 'Close', { duration: 3000 });
    } catch (e) {
      console.error('Failed to save profile', e);
      throw e;
    }
  }

  async deleteProfile(profileId: URN): Promise<void> {
    const cacheId = this.activeCacheId();
    if (!cacheId) return;

    try {
      await firstValueFrom(this.client.deleteProfile(cacheId, profileId));

      this.activeProfiles.update((profiles) =>
        profiles.filter((p) => !p.id.equals(profileId)),
      );
      this.snackBar.open('Filter profile deleted', 'Close', { duration: 3000 });
    } catch (e) {
      console.error('Failed to delete profile', e);
      this.showError('Failed to delete profile.');
    }
  }
}
