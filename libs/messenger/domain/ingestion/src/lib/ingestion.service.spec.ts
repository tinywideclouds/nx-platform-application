import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { IngestionService } from './ingestion.service';
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';

import { URN, QueuedMessage } from '@nx-platform-application/platform-types';

describe('IngestionService', () => {
  let service: IngestionService;
  let storage: ChatStorageService;
  let dataService: ChatDataService;
  let quarantine: QuarantineService;

  const myUrn = URN.parse('urn:contacts:user:me');
  const aliceUrn = URN.parse('urn:contacts:user:alice');
  const groupUrn = URN.parse('urn:messenger:group:team');

  const mockKeys = { encKey: {} as any, sigKey: {} as any };
  const mockQueuedMsg: QueuedMessage = {
    id: 'router-id-1',
    envelope: { recipientId: myUrn } as any,
  };

  const mockTransport = {
    senderId: aliceUrn,
    sentTimestamp: '2025-01-01T12:00:00Z',
    typeId: URN.parse('urn:message:type:text'),
    payloadBytes: new Uint8Array([1, 2, 3]),
    clientRecordId: 'client-uuid-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        IngestionService,
        MockProvider(ChatDataService, {
          getMessageBatch: vi.fn().mockReturnValue(of([mockQueuedMsg])),
          acknowledge: vi.fn().mockReturnValue(of(undefined)),
        }),
        MockProvider(MessengerCryptoService, {
          verifyAndDecrypt: vi.fn().mockResolvedValue(mockTransport),
        }),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(QuarantineService, {
          process: vi.fn().mockResolvedValue(aliceUrn), // Default: Trusted
        }),
        MockProvider(MessageContentParser, {
          parse: vi.fn().mockReturnValue({
            kind: 'content',
            conversationId: groupUrn,
            tags: [],
            payload: { kind: 'text', text: 'hello' },
          }),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(IngestionService);
    storage = TestBed.inject(ChatStorageService);
    dataService = TestBed.inject(ChatDataService);
    quarantine = TestBed.inject(QuarantineService);
  });

  describe('The Airlock Flow', () => {
    it('should parse and save message if Quarantine approves (Returns URN)', async () => {
      // Act
      const result = await service.process(mockKeys, myUrn, new Set());

      // Assert
      expect(quarantine.process).toHaveBeenCalled();
      expect(storage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: aliceUrn,
          textContent: 'hello',
        }),
      );
      expect(result.messages.length).toBe(1);
    });

    it('should NOT parse or save if Quarantine rejects (Returns null)', async () => {
      // Arrange: Quarantine says "Stop" (Blocked or Jailed)
      vi.mocked(quarantine.process).mockResolvedValue(null);

      // Act
      const result = await service.process(mockKeys, myUrn, new Set());

      // Assert
      expect(quarantine.process).toHaveBeenCalled(); // Guard was checked
      expect(storage.saveMessage).not.toHaveBeenCalled(); // Lab was NOT entered
      expect(result.messages.length).toBe(0);

      // We still acknowledge the message to remove it from the queue
      expect(dataService.acknowledge).toHaveBeenCalledWith(['router-id-1']);
    });
  });
});
