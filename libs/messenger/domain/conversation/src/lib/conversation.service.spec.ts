import { TestBed } from '@angular/core/testing';
import { ConversationService } from './conversation.service';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import {
  HistoryReader,
  ConversationStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { DirectoryQueryApi } from '@nx-platform-application/directory-api';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  MessageContentParser,
  MessageTypeText,
} from '@nx-platform-application/messenger-domain-message-content';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import { ChatMessage } from '@nx-platform-application/messenger-types';

describe('ConversationService', () => {
  let service: ConversationService;
  let historyReader: HistoryReader;
  let storage: ConversationStorage;
  let contentParser: MessageContentParser;

  const myUrn = URN.parse('urn:contacts:user:me');
  const groupUrn = URN.parse('urn:messenger:group:chat-1');

  // Valid Text Message Bytes
  const mockBytes = new Uint8Array([123]);

  const msgText: ChatMessage = {
    id: 'msg-1',
    conversationUrn: groupUrn,
    senderId: URN.parse('urn:contacts:user:bob'),
    sentTimestamp: '2025-01-01T10:00:00Z' as ISODateTimeString,
    status: 'read',
    typeId: MessageTypeText,
    payloadBytes: mockBytes,
    snippet: 'Hello',
    tags: [],
    receiptMap: {
      'urn:contacts:user:me': 'read',
      'urn:contacts:user:alice': 'read',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ConversationService,
        MockProvider(HistoryReader, {
          getMessages: vi
            .fn()
            .mockResolvedValue({ messages: [msgText], genesisReached: true }),
          getAllConversations: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(ConversationStorage, {
          markConversationAsRead: vi.fn().mockResolvedValue(undefined),
          getConversation: vi
            .fn()
            .mockResolvedValue({ conversationUrn: groupUrn }),
          startConversation: vi.fn().mockResolvedValue(undefined),
          conversationExists: vi.fn().mockResolvedValue(false),
          getMessage: vi.fn().mockResolvedValue(msgText),
          deleteMessage: vi.fn().mockResolvedValue(undefined),
          clearMessageHistory: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(DirectoryQueryApi, {
          getGroup: vi.fn().mockResolvedValue(null),
        }),
        MockProvider(ContactsQueryApi),
        MockProvider(SessionService, {
          snapshot: { networkUrn: myUrn } as any,
        }),
        MockProvider(ChatKeyService, {
          checkRecipientKeys: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(MessageContentParser, {
          parse: vi.fn().mockReturnValue({
            kind: 'content',
            payload: { kind: 'text', text: 'Recovered Text' },
          }),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ConversationService);
    historyReader = TestBed.inject(HistoryReader);
    storage = TestBed.inject(ConversationStorage);
    contentParser = TestBed.inject(MessageContentParser);
  });

  describe('loadContext', () => {
    it('should fetch conversation data and mark as read', async () => {
      const result = await service.loadContext(groupUrn);

      expect(storage.getConversation).toHaveBeenCalledWith(groupUrn);
      expect(storage.markConversationAsRead).toHaveBeenCalledWith(groupUrn);
      expect(historyReader.getMessages).toHaveBeenCalled();

      // Verify Return Structure
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].id).toBe('msg-1');
      expect(result.genesisReached).toBe(true);
    });
  });

  describe('recoverFailedMessage', () => {
    it('should parse bytes, delete message, and return text', async () => {
      const result = await service.recoverFailedMessage('msg-1');

      expect(contentParser.parse).toHaveBeenCalledWith(
        MessageTypeText,
        mockBytes,
      );
      expect(storage.deleteMessage).toHaveBeenCalledWith('msg-1');
      expect(result).toBe('Recovered Text');
    });
  });

  describe('loadMoreMessages', () => {
    it('should delegate to HistoryReader directly', async () => {
      const timestamp = '2020-01-01T00:00:00Z';

      await service.loadMoreMessages(groupUrn, timestamp);

      expect(historyReader.getMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationUrn: groupUrn,
          beforeTimestamp: timestamp,
        }),
      );
    });
  });

  describe('performHistoryWipe', () => {
    it('should delegate to storage', async () => {
      await service.performHistoryWipe();
      expect(storage.clearMessageHistory).toHaveBeenCalled();
    });
  });
});
