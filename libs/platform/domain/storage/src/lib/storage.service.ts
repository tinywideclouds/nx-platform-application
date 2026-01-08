import {
  Injectable,
  inject,
  signal,
  computed,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Logger } from '@nx-platform-application/console-logger';
import {
  VaultProvider,
  VaultDrivers,
} from '@nx-platform-application/platform-infrastructure-storage';

const STORAGE_KEY_PROVIDER = 'tinywide_active_storage_provider';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private logger = inject(Logger);
  private platformId = inject(PLATFORM_ID);

  // Inject the "Menu" of available drivers (Google, Dropbox, etc.)
  private drivers =
    inject<VaultProvider[]>(VaultDrivers, { optional: true }) || [];

  // --- STATE ---

  // Tracks which provider is currently active (e.g. 'google', 'dropbox', or null)
  public readonly activeProviderId = signal<string | null>(null);

  // Computed helper for UI convenience
  public readonly isConnected = computed(() => !!this.activeProviderId());

  constructor() {
    this.restoreSession();
  }

  /**
   * INITIALIZATION
   * Checks LocalStorage for a previously active provider ID.
   * If found, attempts to silently restore that specific session.
   */
  private async restoreSession() {
    // SSR GUARD: Do not access localStorage on the server
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const savedId = localStorage.getItem(STORAGE_KEY_PROVIDER);

    if (savedId) {
      this.logger.info(
        `[StorageService] Attempting to restore '${savedId}'...`,
      );
      const driver = this.getDriver(savedId);

      if (driver) {
        // Attempt silent auth (persist = true)
        const success = await driver.link(true);
        if (success) {
          this.activeProviderId.set(savedId);
          this.logger.info(`[StorageService] Restored '${savedId}' session.`);
        } else {
          // If silent auth fails, clear the stale state
          this.logger.warn(`[StorageService] Failed to restore '${savedId}'.`);
          this.persistState(null);
        }
      } else {
        this.logger.warn(
          `[StorageService] Driver '${savedId}' not found. Clearing session.`,
        );
        this.persistState(null);
      }
    }
  }

  /**
   * USER ACTION: Connect
   * Triggers the interactive login flow for a specific provider.
   */
  async connect(providerId: string): Promise<boolean> {
    const driver = this.getDriver(providerId);

    if (!driver) {
      this.logger.error(`[StorageService] Unknown provider: ${providerId}`);
      return false;
    }

    // Trigger interactive auth
    const success = await driver.link(true);

    if (success) {
      this.activeProviderId.set(providerId);
      this.persistState(providerId);
      this.logger.info(`[StorageService] Connected to ${driver.displayName}`);
    }

    return success;
  }

  /**
   * USER ACTION: Disconnect
   * Signs out and clears local state.
   */
  async disconnect(): Promise<void> {
    const currentId = this.activeProviderId();
    if (currentId) {
      const driver = this.getDriver(currentId);
      if (driver) {
        await driver.unlink();
      }
    }

    this.activeProviderId.set(null);
    this.persistState(null);
    this.logger.info('[StorageService] Disconnected.');
  }

  /**
   * EXPOSED FOR ENGINES
   * Returns the currently active driver instance.
   * Used by Domain Engines (ChatVault, ContactsSync) to perform direct file I/O.
   */
  getActiveDriver(): VaultProvider | null {
    const id = this.activeProviderId();
    return id ? this.getDriver(id) || null : null;
  }

  /**
   * BYOS FEATURE: Public Asset Upload
   * Delegates to the currently active driver.
   */
  async uploadPublicAsset(blob: Blob, filename: string): Promise<string> {
    const driver = this.getActiveDriver();

    if (!driver) {
      throw new Error('No storage provider connected. Cannot upload asset.');
    }

    try {
      const uniqueName = `${Date.now()}_${filename}`;
      return await driver.uploadPublicAsset(blob, uniqueName);
    } catch (e) {
      this.logger.error('[StorageService] Asset upload failed', e);
      throw e;
    }
  }

  // --- INTERNAL HELPERS ---

  private getDriver(id: string): VaultProvider | undefined {
    return this.drivers.find((d) => d.providerId === id);
  }

  private persistState(id: string | null) {
    if (!isPlatformBrowser(this.platformId)) return;

    if (id) {
      localStorage.setItem(STORAGE_KEY_PROVIDER, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_PROVIDER);
    }
  }
}
