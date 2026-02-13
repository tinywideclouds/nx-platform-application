import { TestBed } from '@angular/core/testing';
import {
  ConversationQueryService,
  ConversationKind,
} from './conversation-query.service';
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
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  MessageContentParser,
  MessageTypeText,
  MessageTypeSystem,
} from '@nx-platform-application/messenger-domain-message-content';
import {
  ChatMessage,
  Conversation,
} from '@nx-platform-application/messenger-types';
import { DirectoryQueryApi } from '@nx-platform-application/directory-api';
import { SessionService } from '@nx-platform-application/messenger-domain-session';

describe('ConversationQueryService', () => {
  let service: ConversationQueryService;
  let historyReader: HistoryReader;
  let storage: ConversationStorage;
  let directory: DirectoryQueryApi;
  let contentParser: MessageContentParser;

  const groupUrn = URN.parse('urn:messenger:group:chat-1');
  const userUrn = URN.parse('urn:contacts:user:bob');

  const mockBytes = new Uint8Array([123]);

  const msgText: ChatMessage = {
    id: 'msg-1',
    conversationUrn: groupUrn,
    senderId: userUrn,
    sentTimestamp: '2025-01-01T10:00:00Z' as ISODateTimeString,
    status: 'read',
    typeId: MessageTypeText,
    payloadBytes: mockBytes,
    snippet: 'Hello',
    tags: [],
    receiptMap: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ConversationQueryService,
        MockProvider(HistoryReader, {
          getMessages: vi
            .fn()
            .mockResolvedValue({ messages: [msgText], genesisReached: true }),
          getAllConversations: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(ConversationStorage, {
          getConversation: vi
            .fn()
            .mockResolvedValue({ conversationUrn: groupUrn, unreadCount: 0 }),
          conversationExists: vi.fn().mockResolvedValue(false),
          getMessage: vi.fn().mockResolvedValue(msgText),
          deleteMessage: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(DirectoryQueryApi, {
          getGroup: vi.fn().mockResolvedValue({
            memberState: { 'urn:contacts:user:me': 'joined' },
          }),
        }),
        MockProvider(SessionService, {
          snapshot: { networkUrn: URN.parse('urn:contacts:user:me') } as any,
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

    service = TestBed.inject(ConversationQueryService);
    historyReader = TestBed.inject(HistoryReader);
    storage = TestBed.inject(ConversationStorage);
    directory = TestBed.inject(DirectoryQueryApi);
    contentParser = TestBed.inject(MessageContentParser);
  });

  describe('Hot Cache (Upsert/Remove)', () => {
    it('should upsert a conversation', () => {
      const conv = { id: groupUrn, name: 'Chat 1' } as Conversation;

      service.upsertToCache(conv);

      const result = service.getConversation(groupUrn);
      expect(result).toEqual(conv);
    });

    it('should remove a conversation', () => {
      const conv = { id: groupUrn, name: 'Chat 1' } as Conversation;
      service.upsertToCache(conv);
      service.removeFromCache(groupUrn);

      expect(service.getConversation(groupUrn)).toBeUndefined();
    });
  });

  describe('determineKind', () => {
    it('should return direct for user URNs', async () => {
      const result = await service.determineKind(userUrn);
      expect(result).toEqual({ type: 'direct', partnerId: userUrn });
    });

    it('should return consensus with status for groups', async () => {
      const result = await service.determineKind(groupUrn);

      expect(directory.getGroup).toHaveBeenCalledWith(groupUrn);
      expect(result).toEqual({
        type: 'consensus',
        myStatus: 'joined',
        memberCount: 1,
      });
    });

    it('should handle directory failures gracefully', async () => {
      vi.mocked(directory.getGroup).mockRejectedValue(new Error('Network'));

      // Should fall through to logic that returns void/undefined effectively,
      // but based on code flow it might just finish.
      // However, looking at code: if error caught, it exits block.
      // Then hits "return { type: 'direct' ... }".
      const result = await service.determineKind(groupUrn);
      expect(result).toEqual({ type: 'direct', partnerId: groupUrn });
    });
  });

  describe('loadInitialMessages', () => {
    it('should filter messages for Invited status', async () => {
      const msgSystem = { ...msgText, id: 'sys-1', typeId: MessageTypeSystem };
      vi.mocked(historyReader.getMessages).mockResolvedValue({
        messages: [msgText, msgSystem],
        genesisReached: true,
      });

      const kind: ConversationKind = {
        type: 'consensus',
        myStatus: 'invited',
        memberCount: 5,
      };

      const result = await service.loadInitialMessages(groupUrn, kind);

      // Text message (msgText) should be hidden. System message (sys-1) shown.
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].id).toBe('sys-1');
    });

    it('should return all messages for Joined status', async () => {
      const kind: ConversationKind = {
        type: 'consensus',
        myStatus: 'joined',
        memberCount: 5,
      };

      const result = await service.loadInitialMessages(groupUrn, kind);
      expect(result.messages).toHaveLength(1);
    });
  });

  describe('recoverFailedMessage', () => {
    it('should recover text and delete original', async () => {
      const result = await service.recoverFailedMessage('msg-1');

      expect(contentParser.parse).toHaveBeenCalled();
      expect(storage.deleteMessage).toHaveBeenCalledWith('msg-1');
      expect(result).toBe('Recovered Text');
    });
  });
});
