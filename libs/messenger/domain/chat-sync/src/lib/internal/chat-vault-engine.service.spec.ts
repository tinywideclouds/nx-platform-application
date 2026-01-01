import { TestBed } from '@angular/core/testing';
import { ChatVaultEngine } from './chat-vault-engine.service';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import {
  CLOUD_PROVIDERS,
  CloudStorageProvider,
} from '@nx-platform-application/platform-cloud-access';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  MessageTombstone,
  ChatMessage,
  ConversationSyncState,
} from '@nx-platform-application/messenger-types';

// --- Temporal Mock (Preserved from legacy test) ---
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
                        opts.day,
                      ).padStart(2, '0')}`,
                  }),
                };
              },
              toPlainDate: (opts: any) => ({
                toString: () =>
                  `${y}-${String(m).padStart(2, '0')}-${String(
                    opts.day,
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

describe('ChatVaultEngine (Internal)', () => {
  let service: ChatVaultEngine;
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

  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      sentTimestamp: '2023-11-01T10:00:00Z',
      conversationUrn: bobUrn,
      senderId: URN.parse('urn:contacts:user:me'),
      typeId: URN.parse('urn:message:type:text'),
      status: 'sent',
      tags: [],
    } as any,
  ];

  const mockIndex: ConversationSyncState[] = [
    {
      conversationUrn: bobUrn,
      lastActivityTimestamp: '2023-11-01T10:00:00Z' as ISODateTimeString,
      snippet: 'Hi',
      unreadCount: 0,
      previewType: 'text',
      genesisTimestamp: null,
      lastModified: '2023-11-01T10:00:00Z' as ISODateTimeString,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatVaultEngine,
        MockProvider(ChatStorageService, {
          isCloudEnabled: vi.fn().mockResolvedValue(false),
          setCloudEnabled: vi.fn().mockResolvedValue(undefined),
          getDataRange: vi.fn(),
          getMessagesInRange: vi.fn(),
          getTombstonesInRange: vi.fn().mockResolvedValue([]),
          bulkSaveMessages: vi.fn().mockResolvedValue(undefined),
          getAllConversations: vi.fn().mockResolvedValue([]),
          bulkSaveConversations: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(Logger),
        { provide: CLOUD_PROVIDERS, useValue: [mockProvider] },
      ],
    });

    service = TestBed.inject(ChatVaultEngine);
    storage = TestBed.inject(ChatStorageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Backup (Hierarchy & Twin-Files)', () => {
    beforeEach(() => {
      // Force enabled state
      (service as any)._isCloudEnabled.set(true);
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);

      vi.spyOn(storage, 'getDataRange').mockResolvedValue({
        min: '2023-11-01T00:00:00Z' as ISODateTimeString,
        max: '2023-11-30T00:00:00Z' as ISODateTimeString,
      });
      vi.spyOn(storage, 'getMessagesInRange').mockResolvedValue(mockMessages);
      vi.spyOn(storage, 'getAllConversations').mockResolvedValue(mockIndex);
    });

    it('should upload Manifest, Vault, and Global Index to correct PATHS', async () => {
      await service.backup('google');
      // 1. Manifest, 2. Vault, 3. Global Index
      expect(mockProvider.uploadFile).toHaveBeenCalledTimes(3);
      expect(mockProvider.uploadFile).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('chat_index.json'),
      );
    });
  });

  describe('Merge Logic (Tombstones)', () => {
    it('should REMOVE message from Vault if Local Tombstone exists', async () => {
      const msgId = 'msg-delete-me';

      const deletedRecord: MessageTombstone = {
        messageId: msgId,
        deletedAt: '2023-11-15T12:00:00Z' as ISODateTimeString,
        conversationUrn: bobUrn,
      };

      const mockNovember2023 = {
        year: 2023,
        month: 11,
        daysInMonth: 30,
        toPlainDate: ({ day }: { day: number }) => ({
          toString: () => `2023-11-${String(day).padStart(2, '0')}`,
        }),
      } as any;

      // Remote has the message (Ghost)
      const remoteMsg = {
        ...mockMessages[0],
        id: msgId,
        conversationUrn: bobUrn.toString(), // JSON format
        senderId: 'urn:contacts:user:me',
        typeId: 'urn:message:type:text',
      };

      const remoteVault = {
        version: 1,
        vaultId: '2023_11',
        messages: [remoteMsg],
        tombstones: [],
      };

      vi.spyOn(storage, 'getMessagesInRange').mockResolvedValue([]);
      vi.spyOn(storage, 'getTombstonesInRange').mockResolvedValue([
        deletedRecord,
      ]);

      vi.spyOn(mockProvider, 'downloadFile').mockResolvedValue(remoteVault);

      // Act: Accessing private method for unit testing the complex merge logic
      await (service as any).processVault(
        mockProvider,
        '2023_11',
        mockNovember2023,
      );

      // Assert
      expect(mockProvider.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [], // Ghost exorcised
          tombstones: [deletedRecord],
          messageCount: 0,
        }),
        expect.stringContaining('chat_vault_2023_11.json'),
      );
    });
  });
});
