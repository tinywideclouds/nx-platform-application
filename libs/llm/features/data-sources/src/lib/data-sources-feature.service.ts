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

@Injectable({ providedIn: 'root' })
export class LlmDataSourcesStateService {
  private client = inject(LlmGithubFirestoreClient);
  private snackBar = inject(MatSnackBar);

  // --- STATE SIGNALS ---

  // Global Collection
  caches = signal<CacheBundle[]>([]);
  isCachesLoading = signal<boolean>(false);

  // Active Selection State
  activeCacheId = signal<string | null>(null);
  activeFiles = signal<FileMetadata[]>([]);
  activeProfiles = signal<FilterProfile[]>([]);
  isActiveCacheLoading = signal<boolean>(false);

  syncLogs = signal<SyncStreamEvent[]>([]);

  // --- COMPUTED STATE ---

  activeCache = computed(() => {
    const id = this.activeCacheId();
    if (!id) return null;
    return this.caches().find((c) => c.id === id) || null;
  });

  // Transforms flat cache array into { 'owner/repo': [CacheBundle, CacheBundle] }
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

  async loadFilesForCache(cacheId: string): Promise<void> {
    try {
      const files = await firstValueFrom(this.client.getFiles(cacheId));
      this.activeFiles.set(files);
    } catch (e) {
      console.error(`Failed to load files for cache ${cacheId}`, e);
      this.activeFiles.set([]);
    }
  }

  async selectCache(cacheId: string): Promise<void> {
    this.activeCacheId.set(cacheId);
    this.isActiveCacheLoading.set(true);

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
  }): Promise<string | null> {
    try {
      this.snackBar.open(`Analyzing ${payload.repo}...`, '', {
        duration: 2000,
      });
      const newCache = await this.client.createCache(
        payload.repo,
        payload.branch,
      );

      // Optimistically push the skeleton into the state
      this.caches.update((c) => [...c, newCache]);
      return newCache.id;
    } catch (error) {
      console.error('Failed to create cache skeleton', error);
      this.showError(`Failed to analyze repository ${payload.repo}.`);
      return null;
    }
  }

  executeSync(cacheId: string, ingestionRules: FilterRules): Promise<void> {
    this.syncLogs.set([]); // Reset the terminal

    // Optimistically set status
    this.caches.update((caches) =>
      caches.map((c) => (c.id === cacheId ? { ...c, status: 'syncing' } : c)),
    );

    // Wrap the Observable in a Promise so the UI Component can safely await it
    return new Promise<void>((resolve, reject) => {
      this.client.executeSyncStream(cacheId, ingestionRules).subscribe({
        next: (event: SyncStreamEvent) => {
          // Push new events to the UI signal instantly
          this.syncLogs.update((logs) => [...logs, event]);
        },
        error: (error) => {
          this.caches.update((caches) =>
            caches.map((c) =>
              c.id === cacheId ? { ...c, status: 'failed' } : c,
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

            // Reload fresh data to update UI stats
            await this.loadAllCaches();
            if (this.activeCacheId() === cacheId) {
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

  async saveProfile(req: ProfileRequest, profileId?: string): Promise<void> {
    const cacheId = this.activeCacheId();
    if (!cacheId) {
      // Throw explicitly so the UI ConfirmationDialog catches it and allows retry/cancel
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

      // Update local state to avoid refetching everything
      this.activeProfiles.update((profiles) => {
        const idx = profiles.findIndex((p) => p.id === savedProfile.id);
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
      // We do NOT show a generic error banner here anymore, because the Smart Page
      // will intercept this throw and show the 'Retry/Cancel' ConfirmationDialog instead.
      throw e;
    }
  }

  async deleteProfile(profileId: string): Promise<void> {
    const cacheId = this.activeCacheId();
    if (!cacheId) return;

    try {
      await firstValueFrom(this.client.deleteProfile(cacheId, profileId));

      // Remove from local state
      this.activeProfiles.update((profiles) =>
        profiles.filter((p) => p.id !== profileId),
      );
      this.snackBar.open('Filter profile deleted', 'Close', { duration: 3000 });
    } catch (e) {
      console.error('Failed to delete profile', e);
      this.showError('Failed to delete profile.');
    }
  }
}
