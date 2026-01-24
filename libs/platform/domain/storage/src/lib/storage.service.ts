import {
  Injectable,
  inject,
  signal,
  computed,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  Visibility,
  VaultProvider,
  VaultDrivers,
  AssetResult,
  DriveProvider,
} from '@nx-platform-application/platform-infrastructure-storage';

const STORAGE_KEY_PROVIDER = 'tinywide_active_storage_provider';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private logger = inject(Logger);
  private platformId = inject(PLATFORM_ID);

  // Inject the "Menu" of available drivers (Google-Drive, Dropbox, etc.)
  private drivers =
    inject<VaultProvider[]>(VaultDrivers, { optional: true }) || [];

  // --- STATE ---

  // Tracks which provider is currently active (e.g. 'google-drive', 'dropbox', or null)
  public readonly activeProviderId = signal<DriveProvider | null>(null);

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
    if (!isPlatformBrowser(this.platformId)) return;

    const savedId = localStorage.getItem(STORAGE_KEY_PROVIDER) as DriveProvider;

    if (savedId) {
      this.logger.info(
        `[StorageService] Found saved session for '${savedId}'. Restoring...`,
      );
      // We don't use connect() here because we might want different error handling for restoration
      const success = await this.connect(savedId, false);
      if (!success) {
        this.clearSession(); // Invalid session ID, clean it up
      }
    }
  }

  /**
   * USER ACTION: Connect
   * Triggers the interactive login flow for a specific provider.
   */
  async connect(
    providerId: DriveProvider,
    interactive = true,
  ): Promise<boolean> {
    const driver = this.getDriver(providerId);

    if (!driver) {
      this.logger.error(
        `[StorageService] No driver found for ID: ${providerId}`,
      );
      return false;
    }

    try {
      // 1. Authenticate/Link
      // We pass 'true' to persist the session within the driver (e.g. OIDC tokens)
      const linked = await driver.link(interactive);

      if (linked) {
        // 2. Update State
        this.activeProviderId.set(providerId);
        this.persistSession(providerId);
        this.logger.info(
          `[StorageService] Connected to ${driver.displayName} (${providerId})`,
        );
        return true;
      }

      return false;
    } catch (e) {
      this.logger.error('[StorageService] Connection failed', e);
      return false;
    }
  }

  /**
   * SYSTEM ACTION: Resume
   * Silently activates a driver. Used when the application boot sequence
   * detects a valid server-side integration.
   * [RESTORED] Required by CloudSyncService.
   */
  resume(providerId: DriveProvider): boolean {
    const driver = this.getDriver(providerId);

    if (!driver) {
      this.logger.warn(
        `[StorageService] Cannot resume unknown provider: ${providerId}`,
      );
      return false;
    }

    // Just select it. The driver's internal strategy handles the token.
    this.activeProviderId.set(providerId);
    this.persistSession(providerId);
    this.logger.info(`[StorageService] Resumed connection to ${providerId}`);
    return true;
  }

  /**
   * DISCONNECT
   * Unlinks the active driver and clears persistence.
   */
  async disconnect(): Promise<void> {
    const driver = this.getActiveDriver();
    if (driver) {
      try {
        await driver.unlink();
      } catch (e) {
        this.logger.warn('[StorageService] Unlink warning', e);
      }
    }

    this.activeProviderId.set(null);
    this.clearSession();
    this.logger.info('[StorageService] Disconnected');
  }

  /**
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
  async uploadAsset(
    blob: Blob,
    filename: string,
    visibility: Visibility,
    contentType?: string,
  ): Promise<AssetResult> {
    const driver = this.getActiveDriver();

    if (!driver) {
      throw new Error('No storage provider connected. Cannot upload asset.');
    }

    try {
      const now = Temporal.Now.instant().toString();
      const uniqueName = `${now}_${filename}`;
      return await driver.uploadAsset(
        blob,
        uniqueName,
        visibility,
        contentType,
      );
    } catch (e) {
      this.logger.error('[StorageService] Asset upload failed', e);
      throw e;
    }
  }

  // --- INTERNAL HELPERS ---

  private getDriver(id: string): VaultProvider | undefined {
    return this.drivers.find((d) => d.providerId === id);
  }

  private persistSession(id: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY_PROVIDER, id);
    }
  }

  private clearSession() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(STORAGE_KEY_PROVIDER);
    }
  }
}
