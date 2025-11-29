import { TestBed } from '@angular/core/testing';
import {
  ChatMessageRepository,
  HistoryQuery,
} from './chat-message-repository.service';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatStorageService,
  DecryptedMessage,
} from '@nx-platform-application/chat-storage';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test Helpers
const mockUrn = URN.parse('urn:sm:user:bob');
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
        // ✅ 1. Explicitly mock Storage methods
        MockProvider(ChatStorageService, {
          loadHistorySegment: vi.fn(),
          getConversationMetadata: vi.fn().mockResolvedValue(null), // Default: No known genesis
          setGenesisTimestamp: vi.fn().mockResolvedValue(undefined),
        }),
        // ✅ 2. Explicitly mock Cloud methods
        MockProvider(ChatCloudService, {
          restoreVaultForDate: vi.fn(),
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

  describe('getMessages', () => {
    const query: HistoryQuery = {
      conversationUrn: mockUrn,
      limit: 10,
      beforeTimestamp: '2023-06-01T00:00:00Z',
    };

    it('HIT: should return local messages if limit satisfied (Fast Path)', async () => {
      // Setup: Local DB has enough messages
      const messages = Array(10).fill(mockMsg('1', '2023-05-31'));
      vi.spyOn(storage, 'loadHistorySegment').mockResolvedValue(messages);

      const result = await service.getMessages(query);

      // Assert: No Cloud Call
      expect(result.messages.length).toBe(10);
      expect(cloud.restoreVaultForDate).not.toHaveBeenCalled();
      expect(result.genesisReached).toBe(false);
    });

    it('MISS (Hydration): should call Cloud if local GAP detected', async () => {
      // Setup: Local DB has gap (only 2 messages)
      const partialMessages = [
        mockMsg('1', '2023-05-31'),
        mockMsg('2', '2023-05-30'),
      ];

      // Sequence of Storage calls:
      // 1. Initial check -> Returns partial
      // 2. Post-restore check -> Returns full set (simulated)
      const hydratedMessages = Array(10).fill(mockMsg('x', '2023-05-30'));

      vi.spyOn(storage, 'loadHistorySegment')
        .mockResolvedValueOnce(partialMessages) // 1st call
        .mockResolvedValueOnce(hydratedMessages); // 2nd call

      // Cloud Logic: Found data
      vi.spyOn(cloud, 'restoreVaultForDate').mockResolvedValue(50);

      const result = await service.getMessages(query);

      // Assertions
      expect(storage.loadHistorySegment).toHaveBeenCalledTimes(2);
      expect(cloud.restoreVaultForDate).toHaveBeenCalledWith(
        query.beforeTimestamp
      );
      expect(result.messages.length).toBe(10);
    });

    it('MISS (Genesis): should mark genesis if Cloud also returns empty', async () => {
      // Setup: Local empty, Cloud empty
      vi.spyOn(storage, 'loadHistorySegment').mockResolvedValue([]);
      vi.spyOn(cloud, 'restoreVaultForDate').mockResolvedValue(0);

      const result = await service.getMessages(query);

      // Assert: Mark Genesis
      expect(storage.setGenesisTimestamp).toHaveBeenCalledWith(
        mockUrn,
        query.beforeTimestamp
      );

      // Assert: Result reflects end of history
      expect(result.messages.length).toBe(0);
      expect(result.genesisReached).toBe(true);
    });

    it('GENESIS: should skip Cloud if genesis marker exists and we passed it', async () => {
      // Setup: Genesis is known at Jan 2023
      const genesisTs = '2023-01-01T00:00:00Z';
      vi.spyOn(storage, 'getConversationMetadata').mockResolvedValue({
        conversationUrn: mockUrn.toString(),
        lastSyncedAt: '',
        genesisTimestamp: genesisTs,
      });

      // Query: Asking for data OLDER than Jan 2023 (e.g. Dec 2022)
      const olderQuery: HistoryQuery = {
        ...query,
        beforeTimestamp: '2022-12-31T00:00:00Z',
      };

      vi.spyOn(storage, 'loadHistorySegment').mockResolvedValue([]);

      const result = await service.getMessages(olderQuery);

      // Assert: Short-circuit (No Cloud Call)
      expect(cloud.restoreVaultForDate).not.toHaveBeenCalled();
      expect(result.genesisReached).toBe(true);
    });
  });
});
