import { Injectable, inject } from '@angular/core';
import { MessengerDatabase } from '@nx-platform-application/messenger-infrastructure-db-schema';

// Define known keys to enforce type safety
export const SETTING_KEYS = {
  WIZARD_SEEN: 'ui_wizard_seen',
  THEME_PREFERENCE: 'ui_theme',
} as const;

@Injectable({ providedIn: 'root' })
export class LocalSettingsService {
  private db = inject(MessengerDatabase);

  /**
   * Loads the "Wizard Seen" state.
   * Defaults to FALSE if the key is missing.
   */
  async getWizardSeen(): Promise<boolean> {
    const record = await this.db.settings.get(SETTING_KEYS.WIZARD_SEEN);
    return record?.value ?? false;
  }

  async setWizardSeen(seen: boolean): Promise<void> {
    await this.db.settings.put({
      key: SETTING_KEYS.WIZARD_SEEN,
      value: seen,
    });
  }

  // Generic getter for future expansion (private to enforce specific public API methods)
  private async get<T>(key: string, defaultValue: T): Promise<T> {
    const record = await this.db.settings.get(key);
    return record !== undefined ? record.value : defaultValue;
  }
}
