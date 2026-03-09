import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GithubFirestoreClient } from '@nx-platform-application/data-sources/features/github-firestore-access';
import {
  DataSourceBundle,
  FileMetadata,
  FilterProfile,
  FilterRules,
  ProfileRequest,
  SyncStreamEvent,
} from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

@Injectable({ providedIn: 'root' })
export class DataSourcesService {
  private client = inject(GithubFirestoreClient);
  private snackBar = inject(MatSnackBar);

  // --- STATE SIGNALS ---
  bundles = signal<DataSourceBundle[]>([]);
  isDataSourcesLoading = signal<boolean>(false);

  activeDataSourceId = signal<URN | null>(null);
  activeFiles = signal<FileMetadata[]>([]);
  activeProfiles = signal<FilterProfile[]>([]);
  isActiveDataSourceLoading = signal<boolean>(false);

  syncLogs = signal<SyncStreamEvent[]>([]);

  // --- COMPUTED STATE ---

  bundlesById = computed(() => {
    const map = new Map<string, DataSourceBundle>();
    for (const bundle of this.bundles()) {
      map.set(bundle.id.toString(), bundle);
    }
    return map;
  });

  activeDataSource = computed(() => {
    const id = this.activeDataSourceId();
    if (!id) return null;
    return this.bundlesById().get(id.toString()) || null;
  });

  groupedDataSources = computed(() => {
    const list = this.bundles();
    const groups: Record<string, DataSourceBundle[]> = {};

    for (const bundle of list) {
      if (!groups[bundle.repo]) groups[bundle.repo] = [];
      groups[bundle.repo].push(bundle);
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
    this.activeDataSourceId.set(null);
    this.activeFiles.set([]);
    this.activeProfiles.set([]);
  }

  // --- DATA LOADING ---

  async loadAllDataSources(): Promise<void> {
    this.isDataSourcesLoading.set(true);
    try {
      const data = await firstValueFrom(this.client.listDataSources());
      this.bundles.set(data);
    } catch (error) {
      console.error('Failed to load bundles', error);
      this.showError('Failed to load repositories from the server.');
      this.bundles.set([]);
    } finally {
      this.isDataSourcesLoading.set(false);
    }
  }

  async loadFilesForDataSource(bundleId: URN): Promise<void> {
    try {
      const files = await firstValueFrom(this.client.getFiles(bundleId));
      this.activeFiles.set(files);
    } catch (e) {
      console.error(
        `Failed to load files for bundle ${bundleId.toString()}`,
        e,
      );
      this.activeFiles.set([]);
      throw e;
    }
  }

  async selectDataSource(bundleId: URN): Promise<void> {
    this.activeDataSourceId.set(bundleId);
    this.isActiveDataSourceLoading.set(true);
    this.syncLogs.set([]);

    try {
      await Promise.all([
        this.loadFilesForDataSource(bundleId),
        firstValueFrom(this.client.listProfiles(bundleId)).then((p) =>
          this.activeProfiles.set(p),
        ),
      ]);
    } catch (e) {
      console.error('Failed to load bundle details', e);
      this.showError('Failed to load repository details.');
      this.activeFiles.set([]);
      this.activeProfiles.set([]);
    } finally {
      this.isActiveDataSourceLoading.set(false);
    }
  }

  // --- REPOSITORY LIFECYCLE ACTIONS ---

  async createDataSource(payload: {
    repo: string;
    branch: string;
  }): Promise<URN | null> {
    try {
      this.snackBar.open(`Analyzing ${payload.repo}...`, '', {
        duration: 2000,
      });
      const newDataSource = await this.client.createDataSource(
        payload.repo,
        payload.branch,
      );

      this.bundles.update((c) => [...c, newDataSource]);
      return newDataSource.id;
    } catch (error) {
      console.error('Failed to create bundle skeleton', error);
      this.showError(`Failed to analyze repository ${payload.repo}.`);
      return null;
    }
  }

  executeSync(bundleId: URN, ingestionRules: FilterRules): Promise<void> {
    this.syncLogs.set([]);

    this.bundles.update((bundles) =>
      bundles.map((c) =>
        c.id.equals(bundleId) ? { ...c, status: 'syncing' } : c,
      ),
    );

    return new Promise<void>((resolve, reject) => {
      this.client.executeSyncStream(bundleId, ingestionRules).subscribe({
        next: (event: SyncStreamEvent) => {
          this.syncLogs.update((logs) => [...logs, event]);
        },
        error: (error) => {
          this.bundles.update((bundles) =>
            bundles.map((c) =>
              c.id.equals(bundleId) ? { ...c, status: 'failed' } : c,
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

            await this.loadAllDataSources();
            if (this.activeDataSourceId()?.equals(bundleId)) {
              await this.loadFilesForDataSource(bundleId);
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
    const bundleId = this.activeDataSourceId();
    if (!bundleId) {
      throw new Error('Cannot save a profile without an active bundle ID.');
    }

    try {
      let savedProfile: FilterProfile;

      if (profileId) {
        savedProfile = await firstValueFrom(
          this.client.updateProfile(bundleId, profileId, req),
        );
      } else {
        savedProfile = await firstValueFrom(
          this.client.createProfile(bundleId, req),
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
    const bundleId = this.activeDataSourceId();
    if (!bundleId) return;

    try {
      await firstValueFrom(this.client.deleteProfile(bundleId, profileId));

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
