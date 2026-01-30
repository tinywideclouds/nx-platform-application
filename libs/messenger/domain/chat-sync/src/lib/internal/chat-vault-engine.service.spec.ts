import { TestBed } from '@angular/core/testing';
import { ChatVaultEngine } from './chat-vault-engine.service';
import {
  HistoryReader,
  MessageWriter,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import { signal } from '@angular/core';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageTombstone,
} from '@nx-platform-application/messenger-types';

// --- Temporal Mock ---
vi.mock('@js-temporal/polyfill', () => {
  return {
    Temporal: {
      Now: {
        plainDateISO: vi.fn(() => ({
          year: 2026,
          month: 1,
          day: 7,
          toString: () => '2026-01-07',
        })),
        instant: vi.fn(() => ({
          toString: () => '2026-01-07T10:00:00Z',
          subtract: () => ({
            toString: () => '2026-01-06T10:00:00Z',
          }),
        })),
      },
      PlainDate: {
        from: vi.fn((d) => ({
          year: 2024,
          month: 1,
          day: 1,
          toString: () => d,
        })),
      },
    },
  };
});

describe('ChatVaultEngine', () => {
  let service: ChatVaultEngine;
  let historyReader: HistoryReader;
  let messageWriter: MessageWriter;
  let cloudStorage: StorageService;
  let logger: Logger;

  const mockDriver = {
    providerId: 'google',
    displayName: 'Google Drive',
    writeJson: vi.fn(),
    readJson: vi.fn(),
    listFiles: vi.fn(),
    isAuthenticated: vi.fn(),
    link: vi.fn(),
    unlink: vi.fn(),
  };

  const bobUrn = URN.parse('urn:contacts:user:bob');
  const meUrn = URN.parse('urn:contacts:user:me');

  const createMsg = (id: string, text: string): ChatMessage => ({
    id,
    sentTimestamp: '2026-01-07T10:00:00Z' as ISODateTimeString,
    conversationUrn: bobUrn,
    senderId: meUrn,
    typeId: URN.parse('urn:message:type:text'),
    status: 'sent',
    tags: [],
    textContent: text,
    payloadBytes: new TextEncoder().encode(text),
  });

  const toRawJson = (msg: ChatMessage) => ({
    ...msg,
    conversationUrn: msg.conversationUrn.toString(),
    senderId: msg.senderId.toString(),
    typeId: msg.typeId.toString(),
    tags: msg.tags ? msg.tags.map((t) => t.toString()) : [],
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'mock-uuid-1234'),
    });

    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorageMock);

    TestBed.configureTestingModule({
      providers: [
        ChatVaultEngine,
        MockProvider(HistoryReader, {
          getMessagesInRange: vi.fn().mockResolvedValue([]),
          getTombstonesInRange: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(MessageWriter, {
          bulkSaveMessages: vi.fn().mockResolvedValue(undefined),
          bulkSaveTombstones: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(StorageService, {
          getActiveDriver: vi.fn().mockReturnValue(mockDriver),
          isConnected: signal(true),
        }),
        MockProvider(Logger, {
          info: vi.fn(),
          error: vi.fn(),
        }),
      ],
    });

    service = TestBed.inject(ChatVaultEngine);
    historyReader = TestBed.inject(HistoryReader);
    messageWriter = TestBed.inject(MessageWriter);
    cloudStorage = TestBed.inject(StorageService);
    logger = TestBed.inject(Logger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('backup()', () => {
    it('should write a Delta file if new messages exist', async () => {
      const newMsg = createMsg('m1', 'Hello Cloud');
      (historyReader.getMessagesInRange as Mock).mockResolvedValue([newMsg]);

      await service.backup();

      expect(mockDriver.writeJson).toHaveBeenCalledTimes(1);
      const [path, payload] = mockDriver.writeJson.mock.calls[0];

      expect(path).toContain('tinywide/messaging/deltas');

      // ✅ FIX: Use the mocked UUID, remove reference to "_delta.json"
      expect(path).toContain('mock-uuid-1234.json');

      expect(payload.messages).toHaveLength(1);
      expect(payload.messages[0].id).toBe('m1');
    });

    it('should NOT write anything if no new data exists', async () => {
      (historyReader.getMessagesInRange as Mock).mockResolvedValue([]);
      (historyReader.getTombstonesInRange as Mock).mockResolvedValue([]);

      await service.backup();

      expect(mockDriver.writeJson).not.toHaveBeenCalled();
    });

    it('should include tombstones in the payload', async () => {
      const tombstone: MessageTombstone = {
        messageId: 'del-1',
        conversationUrn: bobUrn,
        deletedAt: '2026-01-07T10:00:00Z' as ISODateTimeString,
      };
      (historyReader.getTombstonesInRange as Mock).mockResolvedValue([
        tombstone,
      ]);

      await service.backup();

      expect(mockDriver.writeJson).toHaveBeenCalled();
      const [_, payload] = mockDriver.writeJson.mock.calls[0];
      expect(payload.tombstones).toHaveLength(1);
      expect(payload.tombstones[0].messageId).toBe('del-1');
    });
  });

  describe('restore()', () => {
    it('should download, hydrate, and save messages to local storage', async () => {
      // ✅ FIX: Simplify match logic and return a FULL vault shape
      mockDriver.readJson.mockImplementation((path: string) => {
        if (path.includes('delta_1.json')) {
          return Promise.resolve({
            version: 1,
            vaultId: 'mock-v1',
            rangeStart: '2026-01-01',
            rangeEnd: '2026-01-02',
            messageCount: 1,
            messages: [
              {
                ...toRawJson(createMsg('remote-1', 'Hydrate Me')),
                payloadBytes: { 0: 72, 1: 105 },
              },
            ],
            tombstones: [],
          });
        }
        return Promise.resolve(null);
      });

      mockDriver.listFiles.mockResolvedValue(['delta_1.json']);

      await service.restore();

      // DEBUG: If failing, check if logger.error was called (meaning hydration crash)
      if ((logger.error as Mock).mock.calls.length > 0) {
        console.error('Restore Error:', (logger.error as Mock).mock.calls[0]);
      }

      expect(messageWriter.bulkSaveMessages).toHaveBeenCalledTimes(1);
      const savedMessages = (messageWriter.bulkSaveMessages as Mock).mock
        .calls[0][0];

      expect(savedMessages).toHaveLength(1);
      expect(savedMessages[0].id).toBe('remote-1');
      expect(savedMessages[0].payloadBytes).toBeInstanceOf(Uint8Array);
    });

    it('should apply remote deletions (tombstones)', async () => {
      mockDriver.listFiles.mockResolvedValue(['delta_del.json']);
      mockDriver.readJson.mockResolvedValue({
        messages: [],
        tombstones: [
          {
            messageId: 'del-remote',
            conversationUrn: bobUrn.toString(),
            deletedAt: '2026-01-07T09:00:00Z',
          },
        ],
      });

      await service.restore();

      expect(messageWriter.bulkSaveTombstones).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ messageId: 'del-remote' }),
        ]),
      );
    });

    it('should do nothing if no files exist', async () => {
      mockDriver.listFiles.mockResolvedValue([]);
      mockDriver.readJson.mockResolvedValue(null);

      await service.restore();

      expect(messageWriter.bulkSaveMessages).not.toHaveBeenCalled();
    });

    it('should trigger compaction if delta count > 10', async () => {
      const deltaFiles = Array.from(
        { length: 11 },
        (_, i) => `delta_${i}.json`,
      );
      mockDriver.listFiles.mockResolvedValue(deltaFiles);

      mockDriver.readJson.mockImplementation((path: string) => {
        if (path.includes('chat_vault')) return Promise.resolve(null);

        const rawMsg = toRawJson(createMsg('m', 'content'));
        return Promise.resolve({
          messages: [{ ...rawMsg, id: `msg_${path}` }],
          tombstones: [],
        });
      });

      await service.restore();

      expect(mockDriver.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('chat_vault_2026_01.json'),
        expect.objectContaining({
          messageCount: 11,
        }),
      );
    });
  });
});
