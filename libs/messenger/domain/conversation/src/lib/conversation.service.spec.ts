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
import { AddressBookApi } from '@nx-platform-application/contacts-api';

import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { MessageViewMapper } from './message-view.mapper';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  MessageContentParser,
  MessageTypeText,
  MessageGroupInvite,
} from '@nx-platform-application/messenger-domain-message-content';

import { ChatMessage } from '@nx-platform-application/messenger-types';

describe('ConversationService', () => {
  let service: ConversationService;
  let addressBook: AddressBookApi;

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

    // ✅ FIX: Use imported URN constants directly (MessageTypeText, MessageGroupInvite)
    msgText = {
      id: 'msg-1',
      conversationUrn: groupUrn,
      senderId: URN.parse('urn:contacts:user:bob'),
      sentTimestamp: '2025-01-01T10:00:00Z' as ISODateTimeString,
      status: 'read',
      typeId: MessageTypeText, // Pre-parsed URN
      payloadBytes: new Uint8Array([1]),
      tags: [],
    };

    msgInvite = {
      id: 'msg-invite',
      conversationUrn: groupUrn,
      senderId: URN.parse('urn:contacts:user:bob'),
      sentTimestamp: '2025-01-01T10:01:00Z' as ISODateTimeString,
      status: 'received',
      typeId: MessageGroupInvite, // Pre-parsed URN
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
          getConversationSummaries: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(ConversationStorage, {
          markConversationAsRead: vi.fn().mockResolvedValue(undefined),
          getConversationIndex: vi.fn().mockResolvedValue({ unreadCount: 0 }),
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
        MockProvider(AddressBookApi, {
          getGroup: vi.fn().mockResolvedValue(null),
        }),
        MockProvider(ChatKeyService, {
          checkRecipientKeys: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(MessageViewMapper, { toView: vi.fn((m) => m) }),
        MockProvider(MessageContentParser),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ConversationService);
    addressBook = TestBed.inject(AddressBookApi);
  });

  function setRawMessages(msgs: ChatMessage[]) {
    (service as any)._rawMessages.set(msgs);
  }

  describe('Lurker Filter Logic', () => {
    it('should HIDE content messages if membership is invited', async () => {
      vi.mocked(addressBook.getGroup).mockResolvedValue({
        members: [{ contactId: myUrn, status: 'invited' }],
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
      vi.mocked(addressBook.getGroup).mockResolvedValue({
        members: [{ contactId: myUrn, status: 'joined' }],
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

      // We verify the storage call as a proxy for the reload logic
      const storage = TestBed.inject(ConversationStorage);
      expect(storage.getMessage).toHaveBeenCalledWith('msg-1');
    });
  });
});
