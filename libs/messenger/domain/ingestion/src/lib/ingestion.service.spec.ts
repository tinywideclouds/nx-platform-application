import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { IngestionService } from './ingestion.service';
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';

// ✅ ADDED: Directory Mutation Mock
import { DirectoryMutationApi } from '@nx-platform-application/directory-api';

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
          applyReceipt: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(QuarantineService, {
          process: vi.fn().mockResolvedValue(aliceUrn),
        }),
        MockProvider(MessageContentParser, {
          parse: vi.fn().mockReturnValue({
            kind: 'content',
            conversationId: groupUrn,
            tags: [],
            payload: { kind: 'text', text: 'hello' },
          }),
        }),
        // ✅ NEW: Directory Mutation API Mock
        MockProvider(DirectoryMutationApi, {
          updateMemberStatus: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(IngestionService);
    storage = TestBed.inject(ChatStorageService);
    dataService = TestBed.inject(ChatDataService);
    quarantine = TestBed.inject(QuarantineService);
  });

  describe('The Airlock Flow (Content)', () => {
    it('should parse and save message if Quarantine approves', async () => {
      const result = await service.process(mockKeys, myUrn, new Set());

      expect(quarantine.process).toHaveBeenCalled();
      expect(storage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: aliceUrn,
          textContent: 'hello',
        }),
      );
      expect(result.messages.length).toBe(1);
    });
  });
});
