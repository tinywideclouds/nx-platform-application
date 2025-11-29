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
import { VaultManifest } from './models/chat-vault.interface';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

// --- Temporal Mock ---
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

  const mockProvider: CloudStorageProvider = {
    providerId: 'google',
    displayName: 'google',
    revokeAccess: vi.fn(),
    requestAccess: vi.fn(),
    hasPermission: vi.fn(),
    listBackups: vi.fn(),
    uploadBackup: vi.fn(),
    downloadBackup: vi.fn(),
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
  };

  const bobUrn = URN.parse('urn:contacts:user:bob');
  const aliceUrn = URN.parse('urn:contacts:user:alice');

  const mockMessages: DecryptedMessage[] = [
    {
      sentTimestamp: '2023-11-01T10:00:00Z',
      conversationUrn: bobUrn,
    } as any,
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatCloudService,
        MockProvider(ChatStorageService, {
          isCloudEnabled: vi.fn().mockResolvedValue(false),
          setCloudEnabled: vi.fn().mockResolvedValue(undefined),
          getDataRange: vi.fn(),
          getMessagesInRange: vi.fn(),
          bulkSaveMessages: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(Logger),
        { provide: CLOUD_PROVIDERS, useValue: [mockProvider] },
      ],
    });

    service = TestBed.inject(ChatCloudService);
    storage = TestBed.inject(ChatStorageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Backup (Twin-File Strategy)', () => {
    beforeEach(() => {
      (service['_isCloudEnabled'] as any).set(true);
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);

      vi.spyOn(storage, 'getDataRange').mockResolvedValue({
        min: '2023-11-01T00:00:00Z' as ISODateTimeString,
        max: '2023-11-30T00:00:00Z' as ISODateTimeString,
      });
      vi.spyOn(storage, 'getMessagesInRange').mockResolvedValue(mockMessages);
      vi.spyOn(mockProvider, 'listBackups').mockResolvedValue([]);
    });

    it('should upload BOTH a Manifest and a Vault', async () => {
      await service.backup('google');

      expect(mockProvider.uploadBackup).toHaveBeenCalledTimes(2);

      // Verify Manifest Upload
      // FIX: Removed 'messages: undefined' check as the key is missing entirely
      expect(mockProvider.uploadBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          vaultId: '2023_11',
          participants: [bobUrn.toString()],
        }),
        'chat_manifest_2023_11.json'
      );

      // Verify Vault Upload
      expect(mockProvider.uploadBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          vaultId: '2023_11',
          messages: mockMessages,
        }),
        'chat_vault_2023_11.json'
      );
    });
  });

  describe('Restore (Optimized Gatekeeper)', () => {
    const targetDate = '2023-11-15T10:00:00Z';
    const vaultId = '2023_11';
    const manifestName = `chat_manifest_${vaultId}.json`;
    const vaultName = `chat_vault_${vaultId}.json`;

    beforeEach(() => {
      (service['_isCloudEnabled'] as any).set(true);
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);
    });

    it('HIT: should download vault if user is found in Manifest', async () => {
      const mockManifest: VaultManifest = {
        version: 1,
        vaultId,
        messageCount: 1,
        rangeStart: '',
        rangeEnd: '',
        participants: [bobUrn.toString()],
      };

      vi.spyOn(mockProvider, 'listBackups').mockImplementation(
        async (query) => {
          if (query === manifestName)
            return [{ fileId: 'man-1', name: manifestName } as any];
          if (query === vaultName)
            return [{ fileId: 'vault-1', name: vaultName } as any];
          return [];
        }
      );

      vi.spyOn(mockProvider, 'downloadBackup')
        .mockResolvedValueOnce(mockManifest)
        .mockResolvedValueOnce({ messages: mockMessages } as any);

      await service.restoreVaultForDate(targetDate, bobUrn);

      expect(mockProvider.downloadBackup).toHaveBeenCalledTimes(2);
      expect(storage.bulkSaveMessages).toHaveBeenCalled();
    });

    it('MISS: should SKIP download if user is NOT in Manifest', async () => {
      const mockManifest: VaultManifest = {
        version: 1,
        vaultId,
        messageCount: 1,
        rangeStart: '',
        rangeEnd: '',
        participants: [aliceUrn.toString()],
      };

      vi.spyOn(mockProvider, 'listBackups').mockImplementation(
        async (query) => {
          if (query === manifestName)
            return [{ fileId: 'man-1', name: manifestName } as any];
          return [];
        }
      );

      vi.spyOn(mockProvider, 'downloadBackup').mockResolvedValueOnce(
        mockManifest
      );

      const count = await service.restoreVaultForDate(targetDate, bobUrn);

      expect(mockProvider.downloadBackup).toHaveBeenCalledTimes(1);
      expect(storage.bulkSaveMessages).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('LEGACY: should FALLBACK to full download if Manifest is missing', async () => {
      vi.spyOn(mockProvider, 'listBackups').mockImplementation(
        async (query) => {
          if (query === manifestName) return [];
          if (query === vaultName)
            return [{ fileId: 'vault-1', name: vaultName } as any];
          return [];
        }
      );

      vi.spyOn(mockProvider, 'downloadBackup').mockResolvedValueOnce({
        messages: mockMessages,
      } as any);

      await service.restoreVaultForDate(targetDate, bobUrn);

      expect(mockProvider.downloadBackup).toHaveBeenCalledTimes(1);
      expect(storage.bulkSaveMessages).toHaveBeenCalled();
    });

    it('GLOBAL: should skip manifest check if no filterUrn provided', async () => {
      vi.spyOn(mockProvider, 'listBackups').mockImplementation(
        async (query) => {
          if (query === vaultName)
            return [{ fileId: 'vault-1', name: vaultName } as any];
          return [];
        }
      );

      vi.spyOn(mockProvider, 'downloadBackup').mockResolvedValueOnce({
        messages: mockMessages,
      } as any);

      await service.restoreVaultForDate(targetDate);

      expect(mockProvider.listBackups).toHaveBeenCalledWith(vaultName);
      expect(storage.bulkSaveMessages).toHaveBeenCalled();
    });
  });
});
