// libs/messenger/cloud-access/src/lib/chat-cloud.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { ChatCloudService } from './chat-cloud.service';
import {
  ChatStorageService,
  DecryptedMessage,
} from '@nx-platform-application/chat-storage';
import {
  CLOUD_PROVIDERS,
  CloudBackupMetadata,
} from '@nx-platform-application/platform-cloud-access';
import { Logger } from '@nx-platform-application/console-logger';
import { vi } from 'vitest';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

// Mock Date for consistent "Current Month" tests (e.g., Nov 2023)
const MOCK_NOW_ISO = '2023-11-15T12:00:00Z';
vi.mock('@js-temporal/polyfill', () => {
  return {
    Temporal: {
      Now: {
        plainDateISO: vi.fn(() => ({
          year: 2023,
          month: 11,
          day: 15,
          toString: () => '2023-11-15',
          toPlainYearMonth: () => ({
            year: 2023,
            month: 11,
            daysInMonth: 30,
            add: vi.fn(), // mocked below per test
          }),
        })),
      },
      PlainDate: {
        from: vi.fn((str) => {
          // Rudimentary parser mock for test purposes
          const [y, m, d] = str.split('-').map(Number);
          return {
            year: y,
            month: m,
            day: d,
            toPlainYearMonth: () => ({
              year: y,
              month: m,
              daysInMonth: 30, // Simplified
              compare: (a: any, b: any) =>
                a.year * 12 + a.month - (b.year * 12 + b.month),
              add: (duration: any) => {
                // Return next month
                let nextM = m + duration.months;
                let nextY = y;
                if (nextM > 12) {
                  nextM = 1;
                  nextY++;
                }
                return {
                  year: nextY,
                  month: nextM,
                  daysInMonth: 30,
                  toPlainDate: (opts: any) => ({
                    toString: () =>
                      `${nextY}-${String(nextM).padStart(2, '0')}-${String(
                        opts.day
                      ).padStart(2, '0')}`,
                  }),
                };
              },
              toPlainDate: (opts: any) => ({
                toString: () =>
                  `${y}-${String(m).padStart(2, '0')}-${String(
                    opts.day
                  ).padStart(2, '0')}`,
              }),
            }),
          };
        }),
      },
      PlainYearMonth: {
        compare: (a: any, b: any) =>
          a.year * 12 + a.month - (b.year * 12 + b.month),
      },
    },
  };
});

// --- Mocks ---
const mockStorage = {
  isCloudEnabled: vi.fn().mockResolvedValue(false),
  setCloudEnabled: vi.fn().mockResolvedValue(undefined),
  getDataRange: vi.fn(),
  getMessagesInRange: vi.fn(),
};

const mockProvider = {
  providerId: 'google',
  requestAccess: vi.fn(),
  hasPermission: vi.fn(),
  listBackups: vi.fn(),
  uploadBackup: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockMessages: DecryptedMessage[] = [
  { sentTimestamp: '2023-10-01T10:00:00Z' } as any,
];

describe('ChatCloudService', () => {
  let service: ChatCloudService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatCloudService,
        { provide: ChatStorageService, useValue: mockStorage },
        { provide: Logger, useValue: mockLogger },
        { provide: CLOUD_PROVIDERS, useValue: [mockProvider] },
      ],
    });

    service = TestBed.inject(ChatCloudService);
  });

  describe('Initialization', () => {
    it('should initialize state from storage', async () => {
      mockStorage.isCloudEnabled.mockResolvedValue(true);
      // Re-create to trigger constructor
      service = TestBed.inject(ChatCloudService);

      // Wait for promise resolution
      await vi.waitFor(() => expect(service.isCloudEnabled()).toBe(true));
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Restored')
      );
    });
  });

  describe('Connection (Guard)', () => {
    it('should enable cloud if provider grants access', async () => {
      mockProvider.requestAccess.mockResolvedValue(true);

      const result = await service.connect('google');

      expect(result).toBe(true);
      expect(service.isCloudEnabled()).toBe(true);
      expect(mockStorage.setCloudEnabled).toHaveBeenCalledWith(true);
    });

    it('should stay offline if provider denies access', async () => {
      mockProvider.requestAccess.mockResolvedValue(false);

      const result = await service.connect('google');

      expect(result).toBe(false);
      expect(service.isCloudEnabled()).toBe(false);
    });
  });

  describe('Backup Strategy', () => {
    beforeEach(() => {
      // Setup: Cloud Enabled, Permission Granted
      vi.spyOn(service as any, 'isCloudEnabled').mockReturnValue(true);
      mockProvider.hasPermission.mockReturnValue(true);
    });

    it('should skip if offline', async () => {
      vi.spyOn(service as any, 'isCloudEnabled').mockReturnValue(false);
      await service.backup('google');
      expect(mockStorage.getDataRange).not.toHaveBeenCalled();
    });

    it('should disconnect if permission is revoked', async () => {
      mockProvider.hasPermission.mockReturnValue(false);
      await service.backup('google');
      expect(mockStorage.setCloudEnabled).toHaveBeenCalledWith(false);
    });

    it('should process "Hot" and "Missing" vaults, skip "Cold"', async () => {
      // 1. Local Data: Oct (Cold) and Nov (Hot/Current)
      mockStorage.getDataRange.mockResolvedValue({
        min: '2023-10-01T00:00:00Z',
        max: '2023-11-15T00:00:00Z',
      });

      // 2. Cloud State: Has Oct ('2023_10') but NOT Nov
      mockProvider.listBackups.mockResolvedValue([
        { name: 'chat_vault_2023_10.json' },
      ]);

      // 3. Mock Data Retrieval
      mockStorage.getMessagesInRange.mockResolvedValue(mockMessages);

      await service.backup('google');

      // EXPECTATION:
      // Oct (2023_10): Exists + Cold -> SKIP upload
      // Nov (2023_11): Missing + Hot -> UPLOAD

      // Check Uploads
      expect(mockProvider.uploadBackup).toHaveBeenCalledTimes(1);
      const callArgs = mockProvider.uploadBackup.mock.calls[0];
      expect(callArgs[1]).toBe('chat_vault_2023_11.json'); // Filename

      // Verify Oct was skipped (getMessagesInRange called only for Nov)
      // Note: In real logic it calls getMessagesInRange inside the loop.
      // Based on our logic:
      // Loop 1 (Oct): Cold & Exists -> Skip processing -> No getMessages
      // Loop 2 (Nov): Hot -> Process -> Call getMessages
      expect(mockStorage.getMessagesInRange).toHaveBeenCalledTimes(1);
    });

    it('should handle empty local data', async () => {
      mockStorage.getDataRange.mockResolvedValue({ min: null, max: null });
      await service.backup('google');
      expect(mockProvider.listBackups).not.toHaveBeenCalled();
    });
  });

  describe('Restore (Lazy Load)', () => {
    const targetDate = '2023-05-15T10:00:00Z';
    const expectedFilename = 'chat_vault_2023_05.json';

    beforeEach(() => {
      // Setup: Cloud enabled, Permission granted
      vi.spyOn(service as any, 'isCloudEnabled').mockReturnValue(true);
      mockProvider.hasPermission.mockReturnValue(true);
    });

    it('should download and import vault if found', async () => {
      // 1. Mock List response (File Exists)
      mockProvider.listBackups.mockResolvedValue([
        { fileId: 'file-123', name: expectedFilename },
      ]);

      // 2. Mock Download response
      const mockVault: ChatVault = {
        vaultId: '2023_05',
        messages: [{ messageId: 'm1' } as any],
        version: 1,
        rangeStart: '',
        rangeEnd: '',
        messageCount: 1,
      };
      mockProvider.downloadBackup.mockResolvedValue(mockVault);

      // 3. Execute
      const count = await service.restoreVaultForDate(targetDate);

      // 4. Verify
      expect(mockProvider.listBackups).toHaveBeenCalledWith(expectedFilename);
      expect(mockProvider.downloadBackup).toHaveBeenCalledWith('file-123');

      // Important: Verify Storage Integration
      // (You'll need to add bulkSaveMessages to your mockStorage object in the spec setup)
      expect(mockStorage.bulkSaveMessages).toHaveBeenCalledWith(
        mockVault.messages
      );
      expect(count).toBe(1);
    });

    it('should return 0 if vault not found', async () => {
      // 1. Mock List response (Empty)
      mockProvider.listBackups.mockResolvedValue([]);

      const count = await service.restoreVaultForDate(targetDate);

      expect(mockProvider.downloadBackup).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('should return 0 if offline', async () => {
      vi.spyOn(service as any, 'isCloudEnabled').mockReturnValue(false);
      const count = await service.restoreVaultForDate(targetDate);
      expect(mockProvider.listBackups).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });
  });
});
