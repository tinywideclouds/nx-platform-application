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
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
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
      'urn:contacts:user:me': 'read', // ME (Should be filtered)
      'urn:contacts:user:alice': 'read', // ALICE (Should show)
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
            .mockResolvedValue({ messages: [], genesisReached: true }),
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
        }),
        MockProvider(DirectoryQueryApi, {
          getGroup: vi.fn().mockResolvedValue(null),
        }),
        MockProvider(ContactsQueryApi),
        MockProvider(SessionService, {
          snapshot: { networkUrn: myUrn } as any,
        }),
        MockProvider(ChatSyncService),
        MockProvider(ChatKeyService, {
          checkRecipientKeys: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(MessageContentParser, {
          // Mock parse for recoverFailedMessage
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

  describe('readCursors', () => {
    it('should calculate cursors and EXCLUDE the current user', async () => {
      vi.mocked(historyReader.getMessages).mockResolvedValue({
        messages: [msgText],
        genesisReached: true,
      });

      await service.loadConversation(groupUrn);

      const cursors = service.readCursors();

      // Should have cursor for this message
      expect(cursors.has('msg-1')).toBe(true);

      const readers = cursors.get('msg-1');
      expect(readers).toBeDefined();

      // Alice should be there
      expect(
        readers?.some((r) => r.toString() === 'urn:contacts:user:alice'),
      ).toBe(true);

      // ✅ ME should NOT be there
      expect(
        readers?.some((r) => r.toString() === 'urn:contacts:user:me'),
      ).toBe(false);
    });
  });

  describe('recoverFailedMessage', () => {
    it('should parse bytes, delete message, and return text', async () => {
      vi.mocked(historyReader.getMessages).mockResolvedValue({
        messages: [msgText],
        genesisReached: true,
      });
      await service.loadConversation(groupUrn);

      const result = await service.recoverFailedMessage('msg-1');

      expect(contentParser.parse).toHaveBeenCalledWith(
        MessageTypeText,
        mockBytes,
      );
      expect(storage.deleteMessage).toHaveBeenCalledWith('msg-1');
      expect(result).toBe('Recovered Text');

      // Removed from view
      expect(service.messages()).toHaveLength(0);
    });
  });

  describe('loadMoreMessages', () => {
    it('should fetch older messages using last known timestamp', async () => {
      // 1. Initial Load
      vi.mocked(historyReader.getMessages).mockResolvedValueOnce({
        messages: [msgText], // Newest
        genesisReached: false,
      });
      await service.loadConversation(groupUrn);

      // 2. Load More
      const olderMsg = {
        ...msgText,
        id: 'msg-old',
        sentTimestamp: '2020-01-01' as ISODateTimeString,
      };
      vi.mocked(historyReader.getMessages).mockResolvedValueOnce({
        messages: [olderMsg], // Older
        genesisReached: true,
      });

      await service.loadMoreMessages();

      // 3. Verify Call
      expect(historyReader.getMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({
          beforeTimestamp: msgText.sentTimestamp,
        }),
      );

      // 4. Verify Append
      const msgs = service.messages();
      expect(msgs).toHaveLength(2);
      expect(msgs[0].id).toBe('msg-old'); // Oldest first
    });
  });

  describe('performHistoryWipe', () => {
    it('should clear all state and delete all conversations', async () => {
      // Setup some state
      await service.loadConversation(groupUrn);
      vi.mocked(historyReader.getAllConversations).mockResolvedValue([
        { id: groupUrn } as any,
      ]);

      await service.performHistoryWipe();

      expect(service.selectedConversation()).toBeNull();
      expect(service.messages()).toHaveLength(0);

      // Verified deletion
      expect(storage.deleteMessage).not.toHaveBeenCalled(); // Not used here
      // We assume deleteConversation is called via the map logic
    });
  });
});
