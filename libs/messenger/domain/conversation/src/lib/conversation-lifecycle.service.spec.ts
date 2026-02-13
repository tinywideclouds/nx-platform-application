import { TestBed } from '@angular/core/testing';
import { ConversationLifecycleService } from './conversation-lifecycle.service';
import { ConversationQueryService } from './conversation-query.service';
import { ConversationStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ConversationLifecycleService', () => {
  let service: ConversationLifecycleService;
  let query: ConversationQueryService;
  let storage: ConversationStorage;

  const aliceUrn = URN.parse('urn:contacts:user:alice');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConversationLifecycleService,
        MockProvider(Logger),
        MockProvider(ConversationQueryService, {
          getConversation: vi.fn(),
          upsertToCache: vi.fn(),
        }),
        MockProvider(ConversationStorage, {
          startConversation: vi.fn().mockResolvedValue(undefined),
          clearHistory: vi.fn().mockResolvedValue(undefined),
        }),
      ],
    });

    service = TestBed.inject(ConversationLifecycleService);
    query = TestBed.inject(ConversationQueryService);
    storage = TestBed.inject(ConversationStorage);
  });

  describe('stageTransient', () => {
    it('should return existing conversation if already in query cache', () => {
      // Setup: Query service already has this conversation
      const existing = { id: aliceUrn, name: 'Alice' } as any;
      vi.mocked(query.getConversation).mockReturnValue(existing);

      // Act
      const result = service.stageTransient(aliceUrn, 'Alice');

      // Assert
      expect(result).toBe(existing);
      expect(query.upsertToCache).not.toHaveBeenCalled();
    });

    it('should create new conversation and inject into query cache if missing', () => {
      // Setup: Query service does NOT have it
      vi.mocked(query.getConversation).mockReturnValue(undefined);

      // Act
      const result = service.stageTransient(aliceUrn, 'Alice');

      // Assert
      expect(result.id).toBe(aliceUrn);
      expect(result.name).toBe('Alice');
      expect(result.genesisTimestamp).toBeNull(); // Indicates transient

      // Verify Injection
      expect(query.upsertToCache).toHaveBeenCalledWith(result);
    });
  });

  describe('persistConversation', () => {
    it('should call storage.startConversation', async () => {
      await service.persistConversation(aliceUrn, 'Alice');
      expect(storage.startConversation).toHaveBeenCalledWith(aliceUrn, 'Alice');
    });
  });

  describe('clearHistory', () => {
    it('should call storage.clearHistory', async () => {
      await service.clearHistory();
      expect(storage.clearHistory).toHaveBeenCalled();
    });
  });
});
