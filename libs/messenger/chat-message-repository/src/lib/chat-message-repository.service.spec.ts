// libs/messenger/chat-message-repository/src/lib/chat-message-repository.service.spec.ts

import { TestBed } from '@angular/core/testing';
import {
  ChatMessageRepository,
  HistoryQuery,
} from './chat-message-repository.service';
import { URN } from '@nx-platform-application/platform-types';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import {
  ChatMessage, // ✅ UPDATED
  ConversationSummary, // ✅ IMPORT FROM CORRECT SOURCE
} from '@nx-platform-application/messenger-types';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';

// Test Helpers
const mockUrn = URN.parse('urn:contacts:user:bob');
const mockMsg = (id: string, ts: string): ChatMessage =>
  ({
    id: id, // ✅ ChatMessage uses 'id', not 'messageId'
    messageId: id, // Optional backward compat if your type still has it, otherwise remove
    sentTimestamp: ts,
    conversationUrn: mockUrn,
  }) as any;

describe('ChatMessageRepository', () => {
  let service: ChatMessageRepository;
  let storage: ChatStorageService;
  let cloud: ChatCloudService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatMessageRepository,
        MockProvider(ChatStorageService, {
          loadHistorySegment: vi.fn(),
          loadConversationSummaries: vi.fn().mockResolvedValue([]),
          getConversationIndex: vi.fn().mockResolvedValue(undefined),
          setGenesisTimestamp: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatCloudService, {
          isCloudEnabled: signal(true),
          restoreVaultForDate: vi.fn().mockResolvedValue(0),
          restoreIndex: vi.fn().mockResolvedValue(false),
        }),
      ],
    });

    service = TestBed.inject(ChatMessageRepository);
    storage = TestBed.inject(ChatStorageService);
    cloud = TestBed.inject(ChatCloudService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConversationSummaries (Inbox Hydration)', () => {
    it('LOCAL HIT: should return local summaries immediately if data exists', async () => {
      const mockSummaries = [
        { conversationUrn: mockUrn },
      ] as ConversationSummary[];
      vi.spyOn(storage, 'loadConversationSummaries').mockResolvedValue(
        mockSummaries,
      );

      const result = await service.getConversationSummaries();

      expect(result).toEqual(mockSummaries);
      expect(cloud.restoreIndex).not.toHaveBeenCalled();
      expect(cloud.restoreVaultForDate).not.toHaveBeenCalled();
    });

    it('GLOBAL INDEX HIT: should download Index and stop scanning', async () => {
      vi.spyOn(storage, 'loadConversationSummaries')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ conversationUrn: mockUrn } as any]);

      vi.spyOn(cloud, 'restoreIndex').mockResolvedValue(true);

      await service.getConversationSummaries();

      expect(cloud.restoreIndex).toHaveBeenCalled();
      expect(cloud.restoreVaultForDate).not.toHaveBeenCalled();
      expect(storage.loadConversationSummaries).toHaveBeenCalledTimes(2);
    });

    it('FALLBACK SCAN: should scan recent months if Global Index is missing', async () => {
      vi.spyOn(storage, 'loadConversationSummaries').mockResolvedValue([]);
      vi.spyOn(cloud, 'restoreIndex').mockResolvedValue(false);
      vi.spyOn(cloud, 'restoreVaultForDate').mockResolvedValue(10);

      await service.getConversationSummaries();

      expect(cloud.restoreIndex).toHaveBeenCalled();
      expect(cloud.restoreVaultForDate).toHaveBeenCalled();
    });
  });

  describe('getMessages (History Detail)', () => {
    const query: HistoryQuery = {
      conversationUrn: mockUrn,
      limit: 10,
      beforeTimestamp: '2023-06-01T00:00:00Z',
    };

    // it('OPTIMIZATION: should Short-Circuit if Genesis already reached', async () => {
    //   vi.spyOn(storage, 'getConversationIndex').mockResolvedValue({
    //     genesisTimestamp: '2023-01-01T00:00:00Z',
    //   } as ConversationIndexRecord);

    //   const oldQuery = { ...query, beforeTimestamp: '2022-12-31T00:00:00Z' };

    //   const result = await service.getMessages(oldQuery);

    //   expect(result.genesisReached).toBe(true);
    //   expect(result.messages).toEqual([]);
    //   expect(storage.loadHistorySegment).not.toHaveBeenCalled();
    // });

    it('OPTIMIZATION: should pass Filter URN to Cloud on gap', async () => {
      vi.spyOn(storage, 'loadHistorySegment').mockResolvedValue([]);

      await service.getMessages(query);

      expect(cloud.restoreVaultForDate).toHaveBeenCalledWith(
        expect.stringContaining('2023'),
        mockUrn,
      );
    });

    it('LOGIC: should update Genesis if Cloud returns 0 (End of History)', async () => {
      vi.spyOn(storage, 'loadHistorySegment').mockResolvedValue([]);
      vi.spyOn(cloud, 'restoreVaultForDate').mockResolvedValue(0);

      await service.getMessages(query);

      expect(storage.setGenesisTimestamp).toHaveBeenCalledWith(
        mockUrn,
        expect.any(String),
      );
    });

    it('HYDRATION: should reload local messages after successful Cloud restore', async () => {
      vi.spyOn(storage, 'loadHistorySegment')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockMsg('1', '2023-05-31')]);

      vi.spyOn(cloud, 'restoreVaultForDate').mockResolvedValue(50);

      const result = await service.getMessages(query);

      expect(storage.loadHistorySegment).toHaveBeenCalledTimes(2);
      expect(result.messages.length).toBe(1);
    });
  });
});
