import { TestBed } from '@angular/core/testing';
import { ConversationService } from './conversation.service';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { HistoryReader } from './ports/history.reader';
import { ConversationStorage } from './ports/conversation.storage';
import { RemoteHistoryLoader } from './ports/remote-history.loader';

import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { MessageViewMapper } from './message-view.mapper';
import { Logger } from '@nx-platform-application/console-logger';
import {
  MessageContentParser,
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_CONTACT_SHARE,
} from '@nx-platform-application/messenger-domain-message-content';

import { ChatMessage } from '@nx-platform-application/messenger-types';

describe('ConversationService', () => {
  let service: ConversationService;
  let historyReader: HistoryReader;
  let storage: ConversationStorage;
  let remoteLoader: RemoteHistoryLoader;
  let outbound: OutboundService;

  const myUrn = URN.parse('urn:contacts:user:me');
  const partnerUrn = URN.parse('urn:contacts:user:bob');
  const mockKeys = { encKey: {} as any, sigKey: {} as any };

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
        MockProvider(RemoteHistoryLoader, {
          isCloudEnabled: vi.fn().mockReturnValue(true),
          restoreVaultForDate: vi.fn().mockResolvedValue(0),
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
    remoteLoader = TestBed.inject(RemoteHistoryLoader);
    outbound = TestBed.inject(OutboundService);
  });

  describe('Smart History Hydration', () => {
    it('STALENESS: should fetch Cloud if local HEAD is older than Index', async () => {
      const staleMsg = { ...msg1, sentTimestamp: '2024-01-01T00:00:00Z' };
      vi.mocked(historyReader.getMessages)
        .mockResolvedValueOnce({
          messages: [staleMsg] as any,
          genesisReached: false,
        })
        .mockResolvedValueOnce({
          messages: [msg2, msg1] as any,
          genesisReached: true,
        });

      vi.mocked(storage.getConversationIndex).mockResolvedValue({
        lastActivityTimestamp: '2025-01-01T10:00:00Z',
      } as any);

      await service.loadConversation(partnerUrn, myUrn);

      expect(remoteLoader.restoreVaultForDate).toHaveBeenCalledWith(
        '2025-01-01T10:00:00Z',
        partnerUrn,
      );
      expect(historyReader.getMessages).toHaveBeenCalledTimes(2);
    });

    it('DEFICIT: should enter Cloud Loop if fewer messages returned than limit', async () => {
      vi.mocked(historyReader.getMessages)
        .mockResolvedValueOnce({ messages: [], genesisReached: false })
        .mockResolvedValueOnce({
          messages: [msg1] as any,
          genesisReached: true,
        });

      vi.mocked(storage.getConversationIndex).mockResolvedValue({
        unreadCount: 0,
        lastActivityTimestamp: undefined,
      } as any);
      vi.mocked(remoteLoader.restoreVaultForDate).mockResolvedValue(10);

      await service.loadConversation(partnerUrn, myUrn);

      expect(remoteLoader.restoreVaultForDate).toHaveBeenCalled();
      expect(historyReader.getMessages).toHaveBeenCalledTimes(2);
    });

    it('OPTIMISTIC: should skip Cloud logic if cloud is disabled', async () => {
      vi.mocked(remoteLoader.isCloudEnabled).mockReturnValue(false);
      vi.mocked(historyReader.getMessages).mockResolvedValue({
        messages: [],
        genesisReached: false,
      });

      await service.loadConversation(partnerUrn, myUrn);

      expect(remoteLoader.restoreVaultForDate).not.toHaveBeenCalled();
    });
  });

  describe('loadConversation', () => {
    it('should load history and set signals', async () => {
      await service.loadConversation(partnerUrn, myUrn);
      expect(service.messages()).toHaveLength(2);
      expect(storage.markConversationAsRead).toHaveBeenCalledWith(partnerUrn);
    });

    it('should detect unread boundary', async () => {
      await service.loadConversation(partnerUrn, myUrn);
      expect(service.firstUnreadId()).toBe('msg-2');
    });

    it('should OPTIMIZE: re-selecting same chat only marks read', async () => {
      await service.loadConversation(partnerUrn, myUrn);
      vi.clearAllMocks();
      await service.loadConversation(partnerUrn, myUrn);
      expect(storage.markConversationAsRead).toHaveBeenCalled();
      expect(historyReader.getMessages).not.toHaveBeenCalled();
    });

    it('should clear state when selecting NULL', async () => {
      (service as any).messages.set([msg1]);
      await service.loadConversation(null, null);
      expect(service.messages()).toEqual([]);
      expect(service.selectedConversation()).toBeNull();
    });
  });

  describe('loadMoreMessages', () => {
    it('should prepend older messages', async () => {
      await service.loadConversation(partnerUrn, myUrn);
      (service as any).genesisReached.set(false);

      const oldMsg = { ...msg1, id: 'msg-0' };
      vi.mocked(historyReader.getMessages).mockResolvedValueOnce({
        messages: [oldMsg] as any,
        genesisReached: true,
      });

      await service.loadMoreMessages();

      const list = service.messages();
      expect(list).toHaveLength(3);
      expect(list[0].id).toBe('msg-0');
    });

    it('should ignore call if already loading', async () => {
      (service as any).isLoadingHistory.set(true);
      await service.loadMoreMessages();
      expect(historyReader.getMessages).not.toHaveBeenCalled();
    });
  });

  describe('Sending (Optimistic UI)', () => {
    it('should update UI immediately (Pending) then update to Final Status', async () => {
      await service.loadConversation(partnerUrn, myUrn);

      const pendingMsg = {
        ...msg2,
        id: 'new-pending-1',
        status: 'pending' as const,
        conversationUrn: partnerUrn,
      };

      let resolveOutcome: (val: any) => void;
      const outcomePromise = new Promise((r) => {
        resolveOutcome = r;
      });

      vi.mocked(outbound.sendMessage).mockResolvedValue({
        message: pendingMsg,
        outcome: outcomePromise as any,
      });

      const sendPromise = service.sendMessage(
        partnerUrn,
        'Hi',
        mockKeys,
        myUrn,
      );

      await sendPromise;

      const msgsBefore = service.messages();
      expect(msgsBefore[2].id).toBe('new-pending-1');
      expect(msgsBefore[2].status).toBe('pending');

      resolveOutcome!('sent');
      await vi.waitFor(() => {
        const msgs = service.messages();
        expect(msgs[2].status).toBe('sent');
      });
    });

    it('should send Contact Shares using the correct type ID', async () => {
      await service.loadConversation(partnerUrn, myUrn);

      await service.sendContactShare(
        partnerUrn,
        { urn: 'urn:user:x', alias: 'X' },
        mockKeys,
        myUrn,
      );

      const calls = vi.mocked(outbound.sendMessage).mock.calls;
      expect(calls.length).toBe(1);

      const args = calls[0];
      const typeId = args[3] as URN;

      expect(typeId.toString()).toBe(MESSAGE_TYPE_CONTACT_SHARE);
    });
  });

  describe('Live Updates', () => {
    it('should append new incoming message if relevant', async () => {
      await service.loadConversation(partnerUrn, myUrn);
      const initialCount = service.messages().length;

      const newMsg = {
        ...msg1,
        id: 'msg-3',
        conversationUrn: partnerUrn,
        textContent: undefined,
      };

      service.upsertMessages([newMsg as any], myUrn);

      const list = service.messages();
      expect(list).toHaveLength(initialCount + 1);
      expect(list[list.length - 1].textContent).toContain('Mapped:');
    });

    it('should IGNORE messages for other conversations', async () => {
      await service.loadConversation(partnerUrn, myUrn);
      const count = service.messages().length;

      const otherMsg = {
        ...msg1,
        conversationUrn: URN.parse('urn:messenger:group:other'),
      };
      service.upsertMessages([otherMsg as any], myUrn);

      expect(service.messages()).toHaveLength(count);
    });

    it('should trigger read receipts for incoming messages if I am viewing', async () => {
      await service.loadConversation(partnerUrn, myUrn);

      const spy = vi.fn();
      const sub = service.readReceiptTrigger$.subscribe(spy);

      const incoming = {
        ...msg1,
        id: 'msg-inc',
        senderId: partnerUrn,
        status: 'sent',
      };

      service.upsertMessages([incoming as any], myUrn);

      await vi.waitFor(() => {
        expect(storage.updateMessageStatus).toHaveBeenCalledWith(
          ['msg-inc'],
          'read',
        );
        expect(spy).toHaveBeenCalledWith(['msg-inc']);
      });
      sub.unsubscribe();
    });
  });

  describe('Computed: readCursors', () => {
    it('should calculate where the partner has read up to', async () => {
      await service.loadConversation(partnerUrn, myUrn);

      let cursors = service.readCursors();
      expect(cursors.has('msg-2')).toBe(false);

      service.messages.update((msgs) =>
        msgs.map((m) => (m.id === 'msg-2' ? { ...m, status: 'read' } : m)),
      );

      cursors = service.readCursors();
      expect(cursors.get('msg-2')).toEqual([partnerUrn]);
    });
  });

  describe('Actions & Recovery', () => {
    it('recoverFailedMessage should parse content and delete message', async () => {
      const failedMsg = {
        ...msg1,
        id: 'fail-1',
        status: 'failed',
        textContent: undefined,
      };
      (service as any).messages.set([failedMsg]);

      const text = await service.recoverFailedMessage('fail-1');

      expect(text).toBe('Recovered Content');
      expect(storage.deleteMessage).toHaveBeenCalledWith('fail-1');
      expect(service.messages()).toHaveLength(0);
    });

    it('performHistoryWipe should reset all state', async () => {
      await service.loadConversation(partnerUrn, myUrn);
      await service.performHistoryWipe();

      expect(storage.clearMessageHistory).toHaveBeenCalled();
      expect(service.messages()).toEqual([]);
      expect(service.selectedConversation()).toBeNull();
    });
  });

  describe('applyIncomingReadReceipts', () => {
    it('should update local message status to read', () => {
      (service as any).messages.set([msg2]);
      service.applyIncomingReadReceipts(['msg-2']);
      expect(service.messages()[0].status).toBe('read');
    });
  });
});
