import { TestBed } from '@angular/core/testing';
import { ChatCloudService } from './chat-cloud.service';
import {
  ChatStorageService,
  DecryptedMessage,
} from '@nx-platform-application/chat-storage';
import {
  CLOUD_PROVIDERS,
  CloudStorageProvider,
} from '@nx-platform-application/platform-cloud-access';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatVault } from './models/chat-vault.interface';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

// --- Temporal Mock (Unchanged) ---
vi.mock('@js-temporal/polyfill', () => {
  return {
    Temporal: {
      Now: {
        plainDateISO: vi.fn(() => ({
          year: 2023,
          month: 11,
          day: 15,
          toString: () => '2023-11-15',
        })),
      },
      PlainDate: {
        from: vi.fn((str) => {
          const [y, m, d] = str.split('-').map(Number);
          return {
            year: y,
            month: m,
            day: d,
            toPlainYearMonth: () => ({
              year: y,
              month: m,
              daysInMonth: 30,
              compare: (a: any, b: any) =>
                a.year * 12 + a.month - (b.year * 12 + b.month),
              add: (duration: any) => {
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

describe('ChatCloudService', () => {
  let service: ChatCloudService;
  let storage: ChatStorageService;

  // Manual mock for the interface token
  const mockProvider: CloudStorageProvider = {
    providerId: 'google',
    requestAccess: vi.fn(),
    hasPermission: vi.fn(),
    listBackups: vi.fn(),
    uploadBackup: vi.fn(),
    downloadBackup: vi.fn(),
  };

  const mockMessages: DecryptedMessage[] = [
    { sentTimestamp: '2023-11-01T10:00:00Z' } as any,
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatCloudService,

        // ✅ FIX 1: Explicitly define the spies.
        // This avoids 'autoSpy' trying to mock non-function properties.
        MockProvider(ChatStorageService, {
          isCloudEnabled: vi.fn().mockResolvedValue(false), // Default state
          setCloudEnabled: vi.fn().mockResolvedValue(undefined),
          getDataRange: vi.fn(),
          getMessagesInRange: vi.fn(),
          bulkSaveMessages: vi.fn().mockResolvedValue(undefined),
        }),

        // ✅ FIX 2: Explicitly spy on Logger methods too
        MockProvider(Logger, {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        }),

        { provide: CLOUD_PROVIDERS, useValue: [mockProvider] },
      ],
    });

    service = TestBed.inject(ChatCloudService);
    storage = TestBed.inject(ChatStorageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize state from storage', async () => {
      // Re-configure storage return value using vi.spyOn to override the default
      vi.spyOn(storage, 'isCloudEnabled').mockResolvedValue(true);

      // Access private method to re-trigger initialization logic
      await (service as any).initCloudState();

      expect(service.isCloudEnabled()).toBe(true);
    });
  });

  describe('Connection (Guard)', () => {
    it('should enable cloud if provider grants access', async () => {
      vi.spyOn(mockProvider, 'requestAccess').mockResolvedValue(true);

      const result = await service.connect('google');

      expect(result).toBe(true);
      expect(service.isCloudEnabled()).toBe(true);
      expect(storage.setCloudEnabled).toHaveBeenCalledWith(true);
    });

    it('should stay offline if provider denies access', async () => {
      vi.spyOn(mockProvider, 'requestAccess').mockResolvedValue(false);

      const result = await service.connect('google');

      expect(result).toBe(false);
      expect(service.isCloudEnabled()).toBe(false);
    });
  });

  describe('Backup Strategy', () => {
    beforeEach(() => {
      // Force "Online" state internally for these tests
      (service['_isCloudEnabled'] as any).set(true);
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);
    });

    it('should skip if offline', async () => {
      (service['_isCloudEnabled'] as any).set(false);

      await service.backup('google');

      expect(storage.getDataRange).not.toHaveBeenCalled();
    });

    it('should disconnect if permission is revoked', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(false);

      await service.backup('google');

      expect(storage.setCloudEnabled).toHaveBeenCalledWith(false);
    });

    it('should process "Hot" and "Missing" vaults, skip "Cold"', async () => {
      vi.spyOn(storage, 'getDataRange').mockResolvedValue({
        min: '2023-10-01T00:00:00Z' as ISODateTimeString,
        max: '2023-11-15T00:00:00Z' as ISODateTimeString,
      });

      vi.spyOn(mockProvider, 'listBackups').mockResolvedValue([
        {
          name: 'chat_vault_2023_10.json',
          fileId: '1',
          createdAt: '',
          sizeBytes: 0,
        },
      ]);

      vi.spyOn(storage, 'getMessagesInRange').mockResolvedValue(mockMessages);

      await service.backup('google');

      // Verify Upload logic
      expect(mockProvider.uploadBackup).toHaveBeenCalledTimes(1);
      const callArgs = (mockProvider.uploadBackup as any).mock.calls[0];
      expect(callArgs[1]).toBe('chat_vault_2023_11.json');

      // Verify Optimization logic (only fetched messages for the missing vault)
      expect(storage.getMessagesInRange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Restore (Lazy Load)', () => {
    const targetDate = '2023-05-15T10:00:00Z';
    const expectedFilename = 'chat_vault_2023_05.json';

    beforeEach(() => {
      (service['_isCloudEnabled'] as any).set(true);
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);
    });

    it('should download and import vault if found', async () => {
      vi.spyOn(mockProvider, 'listBackups').mockResolvedValue([
        {
          fileId: 'file-123',
          name: expectedFilename,
          createdAt: '',
          sizeBytes: 0,
        },
      ]);

      const mockVault: ChatVault = {
        vaultId: '2023_05',
        messages: [{ messageId: 'm1' } as any],
        version: 1,
        rangeStart: '',
        rangeEnd: '',
        messageCount: 1,
      };
      vi.spyOn(mockProvider, 'downloadBackup').mockResolvedValue(mockVault);

      const count = await service.restoreVaultForDate(targetDate);

      expect(mockProvider.listBackups).toHaveBeenCalledWith(expectedFilename);
      expect(mockProvider.downloadBackup).toHaveBeenCalledWith('file-123');
      expect(storage.bulkSaveMessages).toHaveBeenCalledWith(mockVault.messages);
      expect(count).toBe(1);
    });
  });
});
