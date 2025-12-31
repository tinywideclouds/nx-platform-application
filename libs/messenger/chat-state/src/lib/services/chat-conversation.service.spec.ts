import { TestBed } from '@angular/core/testing';
import { ChatConversationService } from './chat-conversation.service';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

// Services & Dependencies
import { ChatMessageRepository } from '@nx-platform-application/chat-message-repository';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ChatKeyService } from './chat-key.service';
import { ChatMessageMapper } from './chat-message.mapper';
import { ChatOutboundService } from './chat-outbound.service';
import { Logger } from '@nx-platform-application/console-logger';
import { MessageContentParser } from '@nx-platform-application/message-content';

// Types
import {
  ChatMessage,
  DecryptedMessage,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';

describe('ChatConversationService', () => {
  let service: ChatConversationService;
  let repository: ChatMessageRepository;
  let storage: ChatStorageService;
  let outbound: ChatOutboundService;
  let mapper: ChatMessageMapper;
  let keyWorker: ChatKeyService;

  // --- Fixtures ---
  const myUrn = URN.parse('urn:contacts:user:me');
  const partnerUrn = URN.parse('urn:contacts:user:bob');
  const mockKeys = { encKey: {} as any, sigKey: {} as any };

  const mockDecryptedMsg: DecryptedMessage = {
    messageId: 'msg-1',
    senderId: partnerUrn,
    recipientId: myUrn,
    conversationUrn: partnerUrn,
    sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
    typeId: URN.parse('urn:message:type:text'),
    payloadBytes: new Uint8Array([1]),
    status: 'read',
    tags: [],
  };

  const mockViewMsg: ChatMessage = {
    id: 'msg-1',
    senderId: partnerUrn,
    conversationUrn: partnerUrn,
    status: 'read',
    content: { kind: 'text', text: 'Hello' },
    tags: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatConversationService,
        MockProvider(ChatMessageRepository, {
          getMessages: vi
            .fn()
            .mockResolvedValue({
              messages: [mockDecryptedMsg],
              genesisReached: true,
            }),
          getConversationSummaries: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(ChatStorageService, {
          markConversationAsRead: vi.fn().mockResolvedValue(undefined),
          getConversationIndex: vi.fn().mockResolvedValue({ unreadCount: 1 }),
          deleteMessage: vi.fn().mockResolvedValue(undefined),
          clearMessageHistory: vi.fn().mockResolvedValue(undefined),
          updateMessageStatus: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatKeyService, {
          checkRecipientKeys: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(ChatMessageMapper, {
          toView: vi.fn().mockReturnValue(mockViewMsg),
        }),
        MockProvider(ChatOutboundService, {
          sendMessage: vi.fn().mockResolvedValue({
            message: {
              ...mockDecryptedMsg,
              messageId: 'pending-1',
              status: 'pending',
            },
            outcome: Promise.resolve('sent'),
          }),
        }),
        MockProvider(MessageContentParser, {
          parse: vi
            .fn()
            .mockReturnValue({
              kind: 'content',
              payload: { kind: 'text', text: 'Recovered Text' },
            }),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ChatConversationService);
    repository = TestBed.inject(ChatMessageRepository);
    storage = TestBed.inject(ChatStorageService);
    outbound = TestBed.inject(ChatOutboundService);
    mapper = TestBed.inject(ChatMessageMapper);
    keyWorker = TestBed.inject(ChatKeyService);
  });

  describe('Loading Conversations', () => {
    it('should load messages, map them to view, and update signals', async () => {
      await service.loadConversation(partnerUrn, myUrn);

      expect(repository.getMessages).toHaveBeenCalledWith(
        expect.objectContaining({ conversationUrn: partnerUrn }),
      );
      expect(mapper.toView).toHaveBeenCalledWith(mockDecryptedMsg);
      expect(service.messages()).toHaveLength(1);
      expect(service.messages()[0].id).toBe('msg-1');
      expect(service.genesisReached()).toBe(true);
    });

    it('should check for recipient keys and update missing-key signal', async () => {
      vi.mocked(keyWorker.checkRecipientKeys).mockResolvedValue(false);

      await service.loadConversation(partnerUrn, myUrn);

      expect(keyWorker.checkRecipientKeys).toHaveBeenCalledWith(partnerUrn);
      expect(service.isRecipientKeyMissing()).toBe(true);
    });
  });

  describe('Pagination', () => {
    it('should load more messages and prepend them', async () => {
      await service.loadConversation(partnerUrn, myUrn);

      const olderMsg = {
        ...mockDecryptedMsg,
        messageId: 'msg-0',
        sentTimestamp: '2024-01-01T00:00:00Z',
      };
      const olderView = { ...mockViewMsg, id: 'msg-0' };

      // Manually reset genesis so pagination triggers
      (service as any).genesisReached.set(false);

      vi.mocked(repository.getMessages).mockResolvedValueOnce({
        messages: [olderMsg],
        genesisReached: true,
      });
      vi.mocked(mapper.toView).mockReturnValueOnce(olderView);

      await service.loadMoreMessages();

      const list = service.messages();
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe('msg-0'); // Oldest first
      expect(list[1].id).toBe('msg-1');
    });
  });

  describe('Sending (Optimistic UI)', () => {
    it('should update UI immediately (Pending) then update to Final Status', async () => {
      // 1. Setup: Load conversation
      await service.loadConversation(partnerUrn, myUrn);

      // 2. Setup Manual Promise Control to simulate Network Latency
      let completeNetworkRequest: (status: MessageDeliveryStatus) => void;
      const delayedOutcome = new Promise<MessageDeliveryStatus>((resolve) => {
        completeNetworkRequest = resolve;
      });

      // Mock outbound to return OUR delayed promise
      vi.mocked(outbound.sendMessage).mockResolvedValue({
        message: {
          ...mockDecryptedMsg,
          messageId: 'temp-1',
          status: 'pending',
        },
        outcome: delayedOutcome,
      });

      vi.mocked(mapper.toView).mockReturnValue({
        ...mockViewMsg,
        id: 'temp-1',
        status: 'pending',
      });

      // 3. Act: Send (Sync)
      // This call is async but the optimistic update happens before the outcome resolves
      const sendPromise = service.sendMessage(
        partnerUrn,
        'Hi',
        mockKeys,
        myUrn,
      );

      // 4. Assert Optimistic State (Immediate)
      const msgsBefore = service.messages();
      expect(msgsBefore).toHaveLength(2);
      expect(msgsBefore[1].status).toBe('pending');

      // 5. Act: Simulate Network Completion
      completeNetworkRequest!('sent');

      // Wait for the service to process the resolution
      await sendPromise;
      // Yield to event loop to allow .then() callback in service to fire
      await new Promise(process.nextTick);

      // 6. Assert Final State
      const msgsAfter = service.messages();
      expect(msgsAfter[1].status).toBe('sent');
    });

    it('should send Contact Shares using the correct type ID', async () => {
      await service.loadConversation(partnerUrn, myUrn);

      await service.sendContactShare(
        partnerUrn,
        { urn: 'urn:user:x', alias: 'X' },
        mockKeys,
        myUrn,
      );

      expect(outbound.sendMessage).toHaveBeenCalledWith(
        mockKeys,
        myUrn,
        partnerUrn,
        expect.objectContaining({ path: 'urn:message:type:contact-share' }),
        expect.any(Uint8Array),
        undefined,
      );
    });
  });

  describe('Recovery & Failure Handling', () => {
    it('should recover text content and delete failed message from UI/Storage', async () => {
      const failedMsg = {
        ...mockViewMsg,
        id: 'fail-1',
        status: 'failed',
        textContent: 'My Draft',
        payloadBytes: new Uint8Array([]),
      };
      (service as any).messages.set([failedMsg]);

      const text = await service.recoverFailedMessage('fail-1');

      expect(text).toBe('Recovered Text');
      expect(storage.deleteMessage).toHaveBeenCalledWith('fail-1');
      expect(service.messages()).toHaveLength(0);
    });
  });

  describe('Signal Handling', () => {
    it('should send Typing Indicator as ephemeral', async () => {
      await service.loadConversation(partnerUrn, myUrn);

      await service.sendTypingIndicator(mockKeys, myUrn);

      expect(outbound.sendMessage).toHaveBeenCalledWith(
        mockKeys,
        myUrn,
        partnerUrn,
        expect.any(Object),
        expect.any(Uint8Array),
        { isEphemeral: true },
      );
    });
  });

  describe('History Wipe', () => {
    it('should clear disk storage and reset all memory signals', async () => {
      (service as any).messages.set([mockViewMsg]);
      (service as any).selectedConversation.set(partnerUrn);

      await service.performHistoryWipe();

      expect(storage.clearMessageHistory).toHaveBeenCalled();
      expect(service.messages()).toEqual([]);
      expect(service.selectedConversation()).toBeNull();
    });
  });
});
