// libs/messenger/chat-cloud-access/src/lib/chat-cloud.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { ChatCloudService } from './chat-cloud.service';
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationIndexRecord,
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
// Deterministic time for testing hierarchy generation (Year/Month)
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

  // Mock Provider (Google Drive)
  const mockProvider: CloudStorageProvider = {
    providerId: 'google',
    displayName: 'Google Drive',
    revokeAccess: vi.fn(),
    requestAccess: vi.fn(),
    hasPermission: vi.fn(),
    listBackups: vi.fn(),
    uploadBackup: vi.fn(),
    downloadBackup: vi.fn(),
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
  };

  // Test Data
  const bobUrn = URN.parse('urn:contacts:user:bob');
  const aliceUrn = URN.parse('urn:contacts:user:alice');

  const mockMessages: DecryptedMessage[] = [
    {
      sentTimestamp: '2023-11-01T10:00:00Z',
      conversationUrn: bobUrn,
    } as any,
  ];

  const mockIndex: ConversationIndexRecord[] = [
    {
      conversationUrn: bobUrn.toString(),
      lastActivityTimestamp: '2023-11-01T10:00:00Z',
      snippet: 'Hi',
      unreadCount: 0,
      previewType: 'text',
      genesisTimestamp: null,
      lastModified: '2023-11-01T10:00:00Z',
    },
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
          getAllConversations: vi.fn().mockResolvedValue([]),
          bulkSaveConversations: vi.fn().mockResolvedValue(undefined),
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

  describe('Backup (Hierarchy & Twin-Files)', () => {
    beforeEach(() => {
      // Simulate Enabled State
      (service['_isCloudEnabled'] as any).set(true);
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);

      // 1. Storage Mock: One month of data
      vi.spyOn(storage, 'getDataRange').mockResolvedValue({
        min: '2023-11-01T00:00:00Z' as ISODateTimeString,
        max: '2023-11-30T00:00:00Z' as ISODateTimeString,
      });
      vi.spyOn(storage, 'getMessagesInRange').mockResolvedValue(mockMessages);

      // 2. Storage Mock: Global Index
      vi.spyOn(storage, 'getAllConversations').mockResolvedValue(mockIndex);
    });

    it('should upload Manifest, Vault, and Global Index to correct PATHS', async () => {
      await service.backup('google');

      // Expect 3 uploads: Manifest, Vault, Index
      expect(mockProvider.uploadFile).toHaveBeenCalledTimes(3);

      // 1. Verify Manifest Upload (tinywide/messaging/2023/chat_manifest_2023_11.json)
      expect(mockProvider.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          vaultId: '2023_11',
          participants: [bobUrn.toString()],
        }),
        'tinywide/messaging/2023/chat_manifest_2023_11.json'
      );

      // 2. Verify Vault Upload (tinywide/messaging/2023/chat_vault_2023_11.json)
      expect(mockProvider.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          vaultId: '2023_11',
          messages: mockMessages,
        }),
        'tinywide/messaging/2023/chat_vault_2023_11.json'
      );

      // 3. Verify Global Index Sync (tinywide/messaging/chat_index.json)
      expect(mockProvider.uploadFile).toHaveBeenCalledWith(
        mockIndex,
        'tinywide/messaging/chat_index.json'
      );
    });
  });

  describe('Restore Vault (Path Aware & Optimized)', () => {
    const targetDate = '2023-11-15T10:00:00Z';
    const year = '2023';
    const vaultId = '2023_11';
    const manifestPath = `tinywide/messaging/${year}/chat_manifest_${vaultId}.json`;
    const vaultPath = `tinywide/messaging/${year}/chat_vault_${vaultId}.json`;

    beforeEach(() => {
      (service['_isCloudEnabled'] as any).set(true);
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);
    });

    it('HIT: should check manifest at PATH, find user, then download vault', async () => {
      const mockManifest: VaultManifest = {
        version: 1,
        vaultId,
        messageCount: 1,
        rangeStart: '',
        rangeEnd: '',
        participants: [bobUrn.toString()],
      };

      // Mock Sequence:
      // 1. checkManifest -> downloadFile(manifestPath)
      // 2. restoreVault -> downloadFile(vaultPath)
      vi.spyOn(mockProvider, 'downloadFile')
        .mockResolvedValueOnce(mockManifest)
        .mockResolvedValueOnce({ messages: mockMessages });

      await service.restoreVaultForDate(targetDate, bobUrn);

      // Verification
      expect(mockProvider.downloadFile).toHaveBeenNthCalledWith(
        1,
        manifestPath
      );
      expect(mockProvider.downloadFile).toHaveBeenNthCalledWith(2, vaultPath);
      expect(storage.bulkSaveMessages).toHaveBeenCalledWith(mockMessages);
    });

    it('MISS: should check manifest, NOT find user, and SKIP vault', async () => {
      const mockManifest: VaultManifest = {
        version: 1,
        vaultId,
        messageCount: 1,
        rangeStart: '',
        rangeEnd: '',
        participants: [aliceUrn.toString()], // Only Alice is here
      };

      vi.spyOn(mockProvider, 'downloadFile').mockResolvedValueOnce(
        mockManifest
      );

      const count = await service.restoreVaultForDate(targetDate, bobUrn);

      // Verification
      expect(mockProvider.downloadFile).toHaveBeenCalledTimes(1);
      expect(mockProvider.downloadFile).toHaveBeenCalledWith(manifestPath);
      expect(storage.bulkSaveMessages).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('FALLBACK: should download vault if Manifest is missing (Fail Open)', async () => {
      // 1. Manifest Download returns NULL (Not Found)
      vi.spyOn(mockProvider, 'downloadFile')
        .mockResolvedValueOnce(null)
        // 2. Vault Download returns Data
        .mockResolvedValueOnce({ messages: mockMessages });

      await service.restoreVaultForDate(targetDate, bobUrn);

      expect(mockProvider.downloadFile).toHaveBeenCalledWith(manifestPath);
      expect(mockProvider.downloadFile).toHaveBeenCalledWith(vaultPath);
      expect(storage.bulkSaveMessages).toHaveBeenCalled();
    });
  });

  describe('Restore Global Index', () => {
    const indexPath = 'tinywide/messaging/chat_index.json';

    beforeEach(() => {
      (service['_isCloudEnabled'] as any).set(true);
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);
    });

    it('should download index from root path and bulk save', async () => {
      vi.spyOn(mockProvider, 'downloadFile').mockResolvedValue(mockIndex);

      const result = await service.restoreIndex();

      expect(mockProvider.downloadFile).toHaveBeenCalledWith(indexPath);
      expect(storage.bulkSaveConversations).toHaveBeenCalledWith(mockIndex);
      expect(result).toBe(true);
    });

    it('should return false if index not found', async () => {
      vi.spyOn(mockProvider, 'downloadFile').mockResolvedValue(null);

      const result = await service.restoreIndex();

      expect(storage.bulkSaveConversations).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
