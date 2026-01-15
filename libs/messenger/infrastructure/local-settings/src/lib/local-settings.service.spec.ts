import { TestBed } from '@angular/core/testing';
import { LocalSettingsService, SETTING_KEYS } from './local-settings.service';
import { MessengerDatabase } from '@nx-platform-application/messenger-infrastructure-db-schema';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LocalSettingsService', () => {
  let service: LocalSettingsService;
  let mockSettingsTable: { get: any; put: any };

  beforeEach(() => {
    // 1. Create a mock for the Dexie Table
    mockSettingsTable = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue(undefined),
    };

    // 2. Mock the Database Class
    const mockDb = {
      settings: mockSettingsTable,
    };

    TestBed.configureTestingModule({
      providers: [
        LocalSettingsService,
        { provide: MessengerDatabase, useValue: mockDb },
      ],
    });

    service = TestBed.inject(LocalSettingsService);
  });

  describe('Wizard State (Onboarding)', () => {
    it('should return FALSE if no setting exists (Default)', async () => {
      // Database returns undefined (not found)
      mockSettingsTable.get.mockResolvedValue(undefined);

      const result = await service.getWizardSeen();

      expect(result).toBe(false);
      expect(mockSettingsTable.get).toHaveBeenCalledWith(
        SETTING_KEYS.WIZARD_SEEN,
      );
    });

    it('should return TRUE if setting is stored as true', async () => {
      // Database returns the record
      mockSettingsTable.get.mockResolvedValue({
        key: SETTING_KEYS.WIZARD_SEEN,
        value: true,
      });

      const result = await service.getWizardSeen();

      expect(result).toBe(true);
    });

    it('should persist the "Seen" intent to the database', async () => {
      await service.setWizardSeen(true);

      expect(mockSettingsTable.put).toHaveBeenCalledWith({
        key: SETTING_KEYS.WIZARD_SEEN,
        value: true,
      });
    });
  });
});
