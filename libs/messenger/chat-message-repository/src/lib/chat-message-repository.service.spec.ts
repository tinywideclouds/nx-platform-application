import { TestBed } from '@angular/core/testing';
import {
  ChatMessageRepository,
  HistoryQuery,
} from './chat-message-repository.service';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationIndexRecord,
} from '@nx-platform-application/chat-storage';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core'; // ✅ Import signal

const mockUrn = URN.parse('urn:contacts:user:bob');
const mockMsg = (id: string, ts: string): DecryptedMessage =>
  ({
    messageId: id,
    sentTimestamp: ts,
  } as any);

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

  describe('getMessages (Orchestrator)', () => {
    const query: HistoryQuery = {
      conversationUrn: mockUrn,
      limit: 10,
      beforeTimestamp: '2023-06-01T00:00:00Z',
    };

    it('OPTIMIZATION: should Short-Circuit if Genesis already reached', async () => {
      // 1. Setup: Index says history starts at Jan 1st 2023
      vi.spyOn(storage, 'getConversationIndex').mockResolvedValue({
        genesisTimestamp: '2023-01-01T00:00:00Z',
      } as ConversationIndexRecord);

      // 2. Query: Asking for messages older than Jan 1st (e.g. 2022)
      const oldQuery = { ...query, beforeTimestamp: '2022-12-31T00:00:00Z' };

      const result = await service.getMessages(oldQuery);

      // 3. Assert: Immediate return, NO DB load, NO Cloud call
      expect(result.genesisReached).toBe(true);
      expect(result.messages).toEqual([]);
      expect(storage.loadHistorySegment).not.toHaveBeenCalled();
      expect(cloud.restoreVaultForDate).not.toHaveBeenCalled();
    });

    it('OPTIMIZATION: should pass Filter URN to Cloud on gap', async () => {
      // 1. Setup: Local DB is empty
      vi.spyOn(storage, 'loadHistorySegment').mockResolvedValue([]);

      // 2. Action
      await service.getMessages(query);

      // 3. Assert: Cloud called WITH the URN filter (Manifest Check)
      expect(cloud.restoreVaultForDate).toHaveBeenCalledWith(
        expect.stringContaining('2023'), // Some date derived from cursor
        mockUrn // <--- The Filter!
      );
    });

    it('LOGIC: should update Genesis if Cloud returns 0 (End of History)', async () => {
      vi.spyOn(storage, 'loadHistorySegment').mockResolvedValue([]);
      vi.spyOn(cloud, 'restoreVaultForDate').mockResolvedValue(0);

      await service.getMessages(query);

      expect(storage.setGenesisTimestamp).toHaveBeenCalledWith(
        mockUrn,
        expect.any(String)
      );
    });

    it('HYDRATION: should reload local messages after successful Cloud restore', async () => {
      // 1. First load: Empty
      // 2. Second load: Has messages
      vi.spyOn(storage, 'loadHistorySegment')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockMsg('1', '2023-05-31')]);

      vi.spyOn(cloud, 'restoreVaultForDate').mockResolvedValue(50); // Found 50 msgs

      const result = await service.getMessages(query);

      expect(storage.loadHistorySegment).toHaveBeenCalledTimes(2);
      expect(result.messages.length).toBe(1);
    });
  });
});
