import { TestBed } from '@angular/core/testing';
import { ChatVaultEngine } from './chat-vault-engine.service';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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
        })),
      },
    },
  };
});

describe('ChatVaultEngine', () => {
  let service: ChatVaultEngine;
  let storage: ChatStorageService;
  let cloudStorage: StorageService;

  // Mock Driver (The "File System")
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

  // Test Data URNs
  const bobUrn = URN.parse('urn:contacts:user:bob');
  const meUrn = URN.parse('urn:contacts:user:me');

  // FIX: Return a Domain Object for "Storage" mocks, but we will manually flatten it for "Cloud" mocks
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

  // Helper to simulate Raw JSON from Cloud (Stringifies URNs)
  const toRawJson = (msg: ChatMessage) => ({
    ...msg,
    conversationUrn: msg.conversationUrn.toString(),
    senderId: msg.senderId.toString(),
    typeId: msg.typeId.toString(),
    tags: msg.tags ? msg.tags.map((t) => t.toString()) : [],
  });

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatVaultEngine,
        MockProvider(ChatStorageService, {
          getMessagesAfter: vi.fn().mockResolvedValue([]),
          getTombstonesAfter: vi.fn().mockResolvedValue([]),
          bulkSaveMessages: vi.fn().mockResolvedValue(undefined),
          bulkSaveTombstones: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(StorageService, {
          getActiveDriver: vi.fn().mockReturnValue(mockDriver),
          isConnected: signal(true),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ChatVaultEngine);
    storage = TestBed.inject(ChatStorageService);
    cloudStorage = TestBed.inject(StorageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('backup()', () => {
    it('should write a Delta file if new messages exist', async () => {
      // 1. Setup: Local storage has 1 new message (Domain Object)
      const newMsg = createMsg('m1', 'Hello Cloud');
      vi.spyOn(storage, 'getMessagesAfter').mockResolvedValue([newMsg]);

      // 2. Action
      await service.backup();

      // 3. Verify
      expect(mockDriver.writeJson).toHaveBeenCalledTimes(1);
      const [path, payload, options] = mockDriver.writeJson.mock.calls[0];

      expect(path).toContain('tinywide/messaging/2026/01/deltas');
      expect(path).toContain('_delta.json');
      expect(options).toEqual({ blindCreate: true });
      expect(payload.messages).toHaveLength(1);
      expect(payload.messages[0].id).toBe('m1');
    });

    it('should NOT write anything if no new data exists', async () => {
      vi.spyOn(storage, 'getMessagesAfter').mockResolvedValue([]);
      vi.spyOn(storage, 'getTombstonesAfter').mockResolvedValue([]);

      await service.backup();

      expect(mockDriver.writeJson).not.toHaveBeenCalled();
    });

    it('should include tombstones in the payload', async () => {
      const tombstone: MessageTombstone = {
        messageId: 'del-1',
        conversationUrn: bobUrn,
        deletedAt: '2026-01-07T10:00:00Z' as ISODateTimeString,
      };
      vi.spyOn(storage, 'getTombstonesAfter').mockResolvedValue([tombstone]);

      await service.backup();

      const [_, payload] = mockDriver.writeJson.mock.calls[0];
      expect(payload.tombstones).toHaveLength(1);
      expect(payload.tombstones[0].messageId).toBe('del-1');
    });
  });

  describe('restore()', () => {
    it('should download, hydrate, and save messages to local storage', async () => {
      // 1. Setup: Cloud has 1 delta file
      mockDriver.readJson.mockImplementation((path: string) => {
        if (path.includes('chat_vault')) return Promise.resolve(null);
        if (path.includes('delta_1.json')) {
          // FIX: Use toRawJson to flatten URNs to strings
          return Promise.resolve({
            messages: [
              {
                ...toRawJson(createMsg('remote-1', 'Hydrate Me')),
                payloadBytes: { 0: 72, 1: 105 }, // "Hi"
              },
            ],
            tombstones: [],
          });
        }
        return Promise.resolve(null);
      });

      mockDriver.listFiles.mockResolvedValue(['delta_1.json']);

      // 2. Action
      await service.restore();

      // 3. Verify Storage Save
      expect(storage.bulkSaveMessages).toHaveBeenCalledTimes(1);
      const savedMessages = (storage.bulkSaveMessages as any).mock.calls[0][0];

      expect(savedMessages).toHaveLength(1);
      const msg = savedMessages[0];

      expect(msg.payloadBytes).toBeInstanceOf(Uint8Array);
      expect(msg.id).toBe('remote-1');
    });

    it('should apply remote deletions (tombstones)', async () => {
      mockDriver.listFiles.mockResolvedValue(['delta_del.json']);
      mockDriver.readJson.mockResolvedValue({
        messages: [],
        tombstones: [
          {
            messageId: 'del-remote',
            conversationUrn: bobUrn.toString(), // Stringified
            deletedAt: '2026-01-07T09:00:00Z',
          },
        ],
      });

      await service.restore();

      expect(storage.bulkSaveTombstones).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ messageId: 'del-remote' }),
        ]),
      );
    });

    it('should do nothing if no files exist', async () => {
      mockDriver.listFiles.mockResolvedValue([]);
      mockDriver.readJson.mockResolvedValue(null);

      await service.restore();

      expect(storage.bulkSaveMessages).not.toHaveBeenCalled();
    });

    it('should trigger compaction if delta count > 10', async () => {
      // 1. Setup: Simulate 11 delta files
      const deltaFiles = Array.from(
        { length: 11 },
        (_, i) => `delta_${i}.json`,
      );
      mockDriver.listFiles.mockResolvedValue(deltaFiles);

      // Return a dummy payload for any delta read
      mockDriver.readJson.mockImplementation((path: string) => {
        if (path.includes('chat_vault')) return Promise.resolve(null);

        // FIX: Use toRawJson to prevent URN parse errors
        const rawMsg = toRawJson(createMsg('m', 'content'));
        return Promise.resolve({
          messages: [{ ...rawMsg, id: `msg_${path}` }],
          tombstones: [],
        });
      });

      // 2. Action
      await service.restore();

      // 3. Verify Compaction
      expect(mockDriver.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('chat_vault_2026_01.json'),
        expect.objectContaining({
          messageCount: 11,
        }),
      );
    });
  });
});
