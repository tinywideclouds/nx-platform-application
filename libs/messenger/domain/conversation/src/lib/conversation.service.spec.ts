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
import { Logger } from '@nx-platform-application/console-logger';
import {
  MessageContentParser,
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_GROUP_INVITE,
  MESSAGE_TYPE_GROUP_INVITE_RESPONSE,
} from '@nx-platform-application/messenger-domain-message-content';

import { ChatMessage } from '@nx-platform-application/messenger-types';

describe('ConversationService', () => {
  let service: ConversationService;
  let addressBook: AddressBookApi;

  const myUrn = URN.parse('urn:contacts:user:me');
  const groupUrn = URN.parse('urn:messenger:group:chat-1');

  const msgText: ChatMessage = {
    id: 'msg-1',
    conversationUrn: groupUrn,
    senderId: URN.parse('urn:contacts:user:bob'), // Sender is NOT me
    sentTimestamp: '2025-01-01T10:00:00Z' as ISODateTimeString,
    status: 'read',
    typeId: URN.parse(MESSAGE_TYPE_TEXT),
    payloadBytes: new Uint8Array([1]),
    tags: [],
  };

  const msgInvite: ChatMessage = {
    id: 'msg-invite',
    conversationUrn: groupUrn,
    senderId: URN.parse('urn:contacts:user:bob'),
    sentTimestamp: '2025-01-01T10:01:00Z' as ISODateTimeString,
    status: 'received',
    typeId: URN.parse(MESSAGE_TYPE_GROUP_INVITE),
    payloadBytes: new Uint8Array([]),
    tags: [],
  };

  const existingMessage: ChatMessage = {
    id: 'msg-existing',
    conversationUrn: groupUrn,
    senderId: myUrn,
    sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
    status: 'read',
    receiptMap: { 'user:1': 'read' }, // Mocking the fresh map
    typeId: URN.parse('urn:message:type:text'),
    payloadBytes: new Uint8Array([]),
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

  // Helper to inject raw messages into the service state
  function setRawMessages(msgs: ChatMessage[]) {
    (service as any)._rawMessages.set(msgs);
  }

  describe('Lurker Filter Logic', () => {
    it('should HIDE content messages if membership is invited', async () => {
      // 1. Setup as Invited
      vi.mocked(addressBook.getGroup).mockResolvedValue({
        members: [{ contactId: myUrn, status: 'invited' }],
      } as any);

      // 2. Load
      await service.loadConversation(groupUrn, myUrn);
      expect(service.membershipStatus()).toBe('invited');

      // 3. Inject Mixed Content
      setRawMessages([msgText, msgInvite]);

      // 4. Verify Filter
      const visible = service.messages();
      expect(visible).toHaveLength(1);

      // ✅ FIX VERIFICATION: Invites should be VISIBLE
      expect(visible[0].id).toBe('msg-invite');

      // Text content should be HIDDEN
      expect(visible.find((m) => m.id === 'msg-1')).toBeUndefined();
    });

    it('should SHOW everything if membership is joined', async () => {
      // 1. Setup as Joined
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

      const msgs = service.messages();
      const updated = msgs.find((m) => m.id === 'msg-1');

      // Verify it loaded the mocked message with the map
      expect(updated?.receiptMap).toBeDefined();
      expect(updated?.receiptMap?.['user:1']).toBe('read');
    });
  });
});
