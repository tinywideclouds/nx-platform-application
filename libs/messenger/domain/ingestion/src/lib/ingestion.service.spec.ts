import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { IngestionService } from './ingestion.service';
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { MessageSecurityService } from '@nx-platform-application/messenger-infrastructure-message-security';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  MessageContentParser,
  MessageSnippetFactory,
} from '@nx-platform-application/messenger-domain-message-content';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';

// ✅ Fix: Import the Protocol Services to mock them
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';
import { ContactProtocolService } from '@nx-platform-application/messenger-domain-contact-protocol';

import { DirectoryMutationApi } from '@nx-platform-application/directory-api';
import { URN, QueuedMessage } from '@nx-platform-application/platform-types';
import { SessionService } from '@nx-platform-application/messenger-domain-session';

describe('IngestionService', () => {
  let service: IngestionService;
  let storage: ChatStorageService;
  let quarantine: QuarantineService;

  const myUrn = URN.parse('urn:contacts:user:me');
  const aliceUrn = URN.parse('urn:contacts:user:alice');
  const groupUrn = URN.parse('urn:messenger:group:team');

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

        // --- Infrastructure Mocks ---
        MockProvider(ChatDataService, {
          getMessageBatch: vi.fn().mockReturnValue(of([mockQueuedMsg])),
          acknowledge: vi.fn().mockReturnValue(of(undefined)),
        }),
        MockProvider(MessageSecurityService, {
          verifyAndDecrypt: vi.fn().mockResolvedValue(mockTransport),
        }),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(true),
          applyReceipt: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(SessionService, {
          snapshot: { keys: { encKey: {} as any, sigKey: {} as any } } as any,
        }),
        MockProvider(Logger),

        // --- Domain Mocks (Gatekeeping & Parsing) ---
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
          serialize: vi.fn().mockReturnValue(new Uint8Array([1])),
        }),
        MockProvider(MessageSnippetFactory, {
          createSnippet: vi.fn().mockReturnValue('Mock Snippet'),
        }),

        // --- Protocol Mocks (The Fix) ---
        // These mocks prevent the test from trying to load AddressBookApi or OutboxStorage
        MockProvider(GroupProtocolService, {
          processIncomingInvite: vi.fn().mockResolvedValue(undefined),
          processSignal: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ContactProtocolService, {
          ensureSession: vi.fn().mockResolvedValue(undefined),
        }),

        // External APIs
        MockProvider(DirectoryMutationApi, {
          updateMemberStatus: vi.fn().mockResolvedValue(undefined),
        }),
      ],
    });

    service = TestBed.inject(IngestionService);
    storage = TestBed.inject(ChatStorageService);
    quarantine = TestBed.inject(QuarantineService);
  });

  describe('The Airlock Flow (Content)', () => {
    it('should parse and save message with generated SNIPPET if Quarantine approves', async () => {
      const result = await service.process(new Set());

      expect(quarantine.process).toHaveBeenCalled();
      expect(storage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: aliceUrn,
          snippet: 'Mock Snippet', // ✅ Verifies the factory was called
        }),
      );
      expect(result.messages.length).toBe(1);
    });
  });
});
