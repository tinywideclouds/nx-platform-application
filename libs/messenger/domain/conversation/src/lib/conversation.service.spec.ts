import { TestBed } from '@angular/core/testing';
import { ConversationService } from './conversation.service';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

// Infrastructure Contracts
import {
  HistoryReader,
  ConversationStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';

// ✅ CORRECT: Address Book API Contract
import { AddressBookApi } from '@nx-platform-application/contacts-api';

import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { MessageViewMapper } from './message-view.mapper';
import { Logger } from '@nx-platform-application/console-logger';
import {
  MessageContentParser,
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_GROUP_INVITE_RESPONSE,
} from '@nx-platform-application/messenger-domain-message-content';

import {
  ChatMessage,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';

describe('ConversationService', () => {
  let service: ConversationService;
  let historyReader: HistoryReader;
  let storage: ConversationStorage;
  let chatSync: ChatSyncService;
  let addressBook: AddressBookApi;

  const myUrn = URN.parse('urn:contacts:user:me');
  const partnerUrn = URN.parse('urn:contacts:user:bob');
  const groupUrn = URN.parse('urn:messenger:group:chat-1');

  const msg1: ChatMessage = {
    id: 'msg-1',
    conversationUrn: partnerUrn,
    senderId: partnerUrn,
    sentTimestamp: '2025-01-01T10:00:00Z' as ISODateTimeString,
    status: 'read',
    typeId: URN.parse(MESSAGE_TYPE_TEXT),
    payloadBytes: new Uint8Array([1]),
    textContent: 'Hello',
    tags: [],
  };

  const msg2: ChatMessage = {
    id: 'msg-2',
    conversationUrn: partnerUrn,
    senderId: myUrn,
    sentTimestamp: '2025-01-01T10:01:00Z' as ISODateTimeString,
    status: 'sent',
    typeId: URN.parse(MESSAGE_TYPE_TEXT),
    payloadBytes: new Uint8Array([2]),
    textContent: 'Hi there',
    tags: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ConversationService,
        MockProvider(HistoryReader, {
          getMessages: vi.fn().mockResolvedValue({
            messages: [msg2, msg1],
            genesisReached: true,
          }),
          getConversationSummaries: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(ConversationStorage, {
          markConversationAsRead: vi.fn().mockResolvedValue(undefined),
          getConversationIndex: vi.fn().mockResolvedValue({
            unreadCount: 1,
            lastActivityTimestamp: '2025-01-01T10:01:00Z',
          }),
          updateMessageStatus: vi.fn().mockResolvedValue(undefined),
          deleteMessage: vi.fn().mockResolvedValue(undefined),
          clearMessageHistory: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatSyncService, {
          isCloudEnabled: vi.fn().mockReturnValue(true),
          restoreVaultForDate: vi.fn().mockResolvedValue(0),
        }),
        // ✅ NEW: Mock Address Book for Group Lookups
        MockProvider(AddressBookApi, {
          getGroup: vi.fn().mockResolvedValue({
            id: groupUrn,
            members: [{ contactId: myUrn, status: 'joined' }],
          }),
        }),
        MockProvider(ChatKeyService, {
          checkRecipientKeys: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(MessageViewMapper, {
          toView: vi.fn((m) => ({
            ...m,
            textContent: m.textContent || 'Mapped: ' + m.id,
          })),
        }),
        MockProvider(OutboundService, {
          sendMessage: vi.fn().mockResolvedValue({
            message: { ...msg2, id: 'pending-1', status: 'pending' },
            outcome: Promise.resolve('sent'),
          }),
        }),
        MockProvider(MessageContentParser, {
          parse: vi.fn().mockReturnValue({
            kind: 'content',
            payload: { kind: 'text', text: 'Recovered Content' },
          }),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ConversationService);
    historyReader = TestBed.inject(HistoryReader);
    storage = TestBed.inject(ConversationStorage);
    chatSync = TestBed.inject(ChatSyncService);
    addressBook = TestBed.inject(AddressBookApi);
  });

  function setRawMessages(msgs: ChatMessage[]) {
    (service as any)._rawMessages.set(msgs);
  }

  describe('loadConversation', () => {
    it('should determine group membership status via AddressBookApi', async () => {
      await service.loadConversation(groupUrn, myUrn);
      expect(addressBook.getGroup).toHaveBeenCalledWith(groupUrn);
      expect(service.membershipStatus()).toBe('joined');
    });
  });

  describe('Lurker Mode (Group Filter)', () => {
    it('should HIDE content messages if status is invited', async () => {
      // 1. Setup as Invited
      vi.mocked(addressBook.getGroup).mockResolvedValue({
        members: [{ contactId: myUrn, status: 'invited' }],
      } as any);

      // 2. Load
      await service.loadConversation(groupUrn, myUrn);
      expect(service.membershipStatus()).toBe('invited');

      // 3. Inject Mixed Content
      const textMsg = { ...msg1, typeId: URN.parse(MESSAGE_TYPE_TEXT) };
      const systemMsg = {
        ...msg1,
        id: 'sys-1',
        typeId: URN.parse(MESSAGE_TYPE_GROUP_INVITE_RESPONSE),
      };

      setRawMessages([textMsg, systemMsg]);

      // 4. Verify Filter
      const visible = service.messages();
      expect(visible).toHaveLength(1);
      expect(visible[0].id).toBe('sys-1'); // Only system msg shown
    });

    it('should SHOW everything if status is joined', async () => {
      // 1. Setup as Joined
      vi.mocked(addressBook.getGroup).mockResolvedValue({
        members: [{ contactId: myUrn, status: 'joined' }],
      } as any);

      await service.loadConversation(groupUrn, myUrn);
      expect(service.membershipStatus()).toBe('joined');

      setRawMessages([msg1, msg2]);
      expect(service.messages()).toHaveLength(2);
    });
  });
});
