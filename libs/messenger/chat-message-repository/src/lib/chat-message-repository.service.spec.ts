// libs/messenger/chat-message-repository/src/lib/chat-message-repository.service.spec.ts

import { TestBed } from '@angular/core/testing';
import {
  ChatMessageRepository,
  HistoryQuery,
} from './chat-message-repository.service';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationMetadata,
} from '@nx-platform-application/chat-storage';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import { vi } from 'vitest';

// Mocks
const mockStorage = {
  loadHistorySegment: vi.fn(),
  getConversationMetadata: vi.fn(),
  setGenesisTimestamp: vi.fn(),
};

const mockCloud = {
  restoreVaultForDate: vi.fn(),
};

const mockUrn = URN.parse('urn:sm:user:bob');
const mockMsg = (id: string, ts: string): DecryptedMessage =>
  ({
    messageId: id,
    sentTimestamp: ts,
  } as any);

describe('ChatMessageRepository', () => {
  let service: ChatMessageRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ChatMessageRepository,
        { provide: ChatStorageService, useValue: mockStorage },
        { provide: ChatCloudService, useValue: mockCloud },
      ],
    });
    service = TestBed.inject(ChatMessageRepository);
  });

  describe('getMessages', () => {
    const query: HistoryQuery = {
      conversationUrn: mockUrn,
      limit: 10,
      beforeTimestamp: '2023-06-01T00:00:00Z',
    };

    it('HIT: should return local messages if limit satisfied', async () => {
      // Local returns 10 messages (Full Page)
      const messages = Array(10).fill(mockMsg('1', '2023-05-31'));
      mockStorage.loadHistorySegment.mockResolvedValue(messages);
      mockStorage.getConversationMetadata.mockResolvedValue(null);

      const result = await service.getMessages(query);

      expect(result.messages.length).toBe(10);
      expect(mockCloud.restoreVaultForDate).not.toHaveBeenCalled();
      expect(result.genesisReached).toBe(false);
    });

    it('MISS (Hydration): should call Cloud if local GAP detected', async () => {
      // Local returns only 2 messages (Gap)
      const partialMessages = [
        mockMsg('1', '2023-05-31'),
        mockMsg('2', '2023-05-30'),
      ];

      // 1. First Call: Returns Partial
      mockStorage.loadHistorySegment.mockResolvedValueOnce(partialMessages);

      // 2. Cloud Restore: Success (returns count > 0)
      mockCloud.restoreVaultForDate.mockResolvedValue(50);

      // 3. Second Call: Returns Full Page (simulated hydration)
      const hydratedMessages = Array(10).fill(mockMsg('x', '2023-05-30'));
      mockStorage.loadHistorySegment.mockResolvedValueOnce(hydratedMessages);

      const result = await service.getMessages(query);

      expect(mockStorage.loadHistorySegment).toHaveBeenCalledTimes(2);
      expect(mockCloud.restoreVaultForDate).toHaveBeenCalledWith(
        query.beforeTimestamp
      );
      expect(result.messages.length).toBe(10);
    });

    it('MISS (Genesis): should mark genesis if Cloud also returns empty', async () => {
      // Local returns 0
      mockStorage.loadHistorySegment.mockResolvedValue([]);

      // Cloud returns 0 (Nothing in backup either)
      mockCloud.restoreVaultForDate.mockResolvedValue(0);

      const result = await service.getMessages(query);

      // Verify we marked genesis
      expect(mockStorage.setGenesisTimestamp).toHaveBeenCalledWith(
        mockUrn,
        query.beforeTimestamp
      );

      // Verify result flags
      expect(result.messages.length).toBe(0);
      // We expect genesisReached to be true because we just set it
      // Note: Implementation re-checks getGenesisTimestamp, so we mock the return
      mockStorage.getConversationMetadata.mockResolvedValue({
        genesisTimestamp: query.beforeTimestamp,
      });
    });

    it('GENESIS: should skip Cloud if genesis marker exists and we passed it', async () => {
      // Genesis is set to Jan 2023
      const genesisTs = '2023-01-01T00:00:00Z';
      mockStorage.getConversationMetadata.mockResolvedValue({
        genesisTimestamp: genesisTs,
      });

      // Query is asking for data BEFORE Jan 2023 (older than genesis)
      const olderQuery: HistoryQuery = {
        ...query,
        beforeTimestamp: '2022-12-31T00:00:00Z',
      };

      mockStorage.loadHistorySegment.mockResolvedValue([]);

      const result = await service.getMessages(olderQuery);

      // Should NOT call cloud because we know history doesn't exist back then
      expect(mockCloud.restoreVaultForDate).not.toHaveBeenCalled();
      expect(result.genesisReached).toBe(true);
    });
  });
});
