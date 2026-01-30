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
  MessageGroupInvite,
  ParsedMessage,
} from '@nx-platform-application/messenger-domain-message-content';

import { ChatMessage } from '@nx-platform-application/messenger-types';

describe('ConversationService', () => {
  let service: ConversationService;
  let directory: DirectoryQueryApi;

  // Define variables here, initialize in beforeEach
  let myUrn: URN;
  let groupUrn: URN;
  let msgText: ChatMessage;
  let msgInvite: ChatMessage;
  let existingMessage: ChatMessage;

  beforeEach(() => {
    // Initialize URNs
    myUrn = URN.parse('urn:contacts:user:me');
    groupUrn = URN.parse('urn:messenger:group:chat-1');

    msgText = {
      id: 'msg-1',
      conversationUrn: groupUrn,
      senderId: URN.parse('urn:contacts:user:bob'),
      sentTimestamp: '2025-01-01T10:00:00Z' as ISODateTimeString,
      status: 'read',
      typeId: MessageTypeText,
      payloadBytes: new TextEncoder().encode('Hello World'),
      tags: [],
    };

    msgInvite = {
      id: 'msg-invite',
      conversationUrn: groupUrn,
      senderId: URN.parse('urn:contacts:user:bob'),
      sentTimestamp: '2025-01-01T10:01:00Z' as ISODateTimeString,
      status: 'received',
      typeId: MessageGroupInvite,
      payloadBytes: new Uint8Array([]),
      tags: [],
    };

    existingMessage = {
      id: 'msg-existing',
      conversationUrn: groupUrn,
      senderId: myUrn,
      sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
      status: 'read',
      receiptMap: { 'user:1': 'read' },
      typeId: MessageTypeText,
      payloadBytes: new Uint8Array([]),
    };

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
          getConversation: vi.fn().mockResolvedValue({ unreadCount: 0 }),
          updateMessageStatus: vi.fn().mockResolvedValue(undefined),
          getMessage: vi.fn().mockImplementation((id) =>
            Promise.resolve({
              ...existingMessage,
              id: id,
            }),
          ),
        }),
        MockProvider(ChatSyncService, {
          isCloudEnabled: vi.fn().mockReturnValue(false),
        }),
        MockProvider(DirectoryQueryApi, {
          getGroup: vi.fn().mockResolvedValue(null),
        }),
        MockProvider(ChatKeyService, {
          checkRecipientKeys: vi.fn().mockResolvedValue(true),
        }),
        // ✅ CORRECTED MOCK (Matches your provided structure)
        MockProvider(MessageContentParser, {
          parse: vi.fn((type: URN, bytes: Uint8Array): ParsedMessage => {
            if (type.equals(MessageTypeText)) {
              return {
                kind: 'content',
                conversationId: URN.parse('urn:contacts:user:123'),
                tags: [],
                payload: {
                  kind: 'text',
                  text: new TextDecoder().decode(bytes),
                },
              };
            }
            return { kind: 'unknown', rawType: type };
          }),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ConversationService);
    directory = TestBed.inject(DirectoryQueryApi);
  });

  function setRawMessages(msgs: ChatMessage[]) {
    (service as any)._rawMessages.set(msgs);
  }

  describe('Hydration & Loading', () => {
    it('should hydrate text content using the Parser', async () => {
      // ✅ FIX: Ensure user is 'joined' so the Lurker filter allows the message through
      vi.mocked(directory.getGroup).mockResolvedValue({
        memberState: { [myUrn.toString()]: 'joined' },
      } as any);

      // Setup Storage to return raw text message
      const historyReader = TestBed.inject(HistoryReader);
      vi.mocked(historyReader.getMessages).mockResolvedValue({
        messages: [msgText],
        genesisReached: true,
      });

      await service.loadConversation(groupUrn, myUrn);

      const msgs = service.messages();
      expect(msgs).toHaveLength(1);
      // Verify hydration logic worked
      expect(msgs[0].textContent).toBe('Hello World');
    });
  });

  describe('Lurker Filter Logic', () => {
    it('should HIDE content messages if membership is invited', async () => {
      vi.mocked(directory.getGroup).mockResolvedValue({
        memberState: { [myUrn.toString()]: 'invited' },
      } as any);

      await service.loadConversation(groupUrn, myUrn);
      expect(service.membershipStatus()).toBe('invited');

      setRawMessages([msgText, msgInvite]);

      const visible = service.messages();
      expect(visible).toHaveLength(1);

      // Invite is allowed
      expect(visible[0].id).toBe('msg-invite');
      // Text content is filtered out
      expect(visible.find((m) => m.id === 'msg-1')).toBeUndefined();
    });

    it('should SHOW everything if membership is joined', async () => {
      vi.mocked(directory.getGroup).mockResolvedValue({
        memberState: { [myUrn.toString()]: 'joined' },
      } as any);

      await service.loadConversation(groupUrn, myUrn);
      expect(service.membershipStatus()).toBe('joined');

      setRawMessages([msgText, msgInvite]);
      expect(service.messages()).toHaveLength(2);
    });
  });

  describe('Receipt Handling', () => {
    it('should reload messages from storage when receipts arrive', async () => {
      await service.applyIncomingReadReceipts(['msg-1']);

      const storage = TestBed.inject(ConversationStorage);
      expect(storage.getMessage).toHaveBeenCalledWith('msg-1');
    });
  });
});
