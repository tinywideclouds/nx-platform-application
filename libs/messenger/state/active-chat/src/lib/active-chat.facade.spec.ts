import { TestBed } from '@angular/core/testing';
import { ActiveChatFacade } from './active-chat.facade';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Subject } from 'rxjs';

import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ConversationService,
  ConversationActionService,
} from '@nx-platform-application/messenger-domain-conversation';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';
import { ChatMessage } from '@nx-platform-application/messenger-types';

describe('ActiveChatFacade', () => {
  let facade: ActiveChatFacade;
  let service: ConversationService;
  let ingestion: IngestionService;
  let groupProtocol: GroupProtocolService;

  // --- STREAMS ---
  const dataIngested$ = new Subject<any>();

  // --- FIXTURES ---
  const myUrn = URN.parse('urn:contacts:user:me');
  const chatUrn = URN.parse('urn:messenger:group:alpha');

  const mockMsg = (
    id: string,
    text: string,
    sender: URN,
    status = 'sent',
  ): ChatMessage =>
    ({
      id,
      conversationUrn: chatUrn,
      senderId: sender,
      snippet: text,
      sentTimestamp: new Date().toISOString() as ISODateTimeString,
      status,
      typeId: {} as any, // Mock type identity
      receiptMap: {},
    }) as ChatMessage;

  // --- MANUAL MOCKS (To isolate dependency trees) ---
  const mockActions = {
    sendMessage: vi.fn().mockImplementation(async (to, text) => {
      return mockMsg('new-id', text, myUrn);
    }),
    markMessagesAsRead: vi.fn(),
    sendTypingIndicator: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ActiveChatFacade,
        MockProvider(ConversationService, {
          // Default happy path for loading
          loadContext: vi.fn().mockResolvedValue({
            conversation: { id: chatUrn, name: 'Chat' },
            messages: [],
            membershipStatus: 'joined',
            genesisReached: true,
            isRecipientKeyMissing: false,
            firstUnreadId: null,
          }),
          fetchMessages: vi.fn().mockResolvedValue([]),
          loadMoreMessages: vi.fn().mockResolvedValue([]),
        }),
        // ISOLATED MOCK: Prevents 'OutboxStorage' DI errors
        {
          provide: ConversationActionService,
          useValue: mockActions,
        },
        MockProvider(IngestionService, {
          dataIngested$,
        }),
        MockProvider(SessionService, {
          snapshot: { networkUrn: myUrn } as any,
        }),
        MockProvider(GroupProtocolService, {
          provisionNetworkGroup: vi.fn().mockResolvedValue(chatUrn),
          acceptInvite: vi.fn().mockResolvedValue(chatUrn),
          rejectInvite: vi.fn().mockResolvedValue(true),
        }),
      ],
    });

    facade = TestBed.inject(ActiveChatFacade);
    service = TestBed.inject(ConversationService);
    ingestion = TestBed.inject(IngestionService);
    groupProtocol = TestBed.inject(GroupProtocolService);
  });

  describe('Initialization & Loading', () => {
    it('should load conversation context and update signals', async () => {
      const messages = [mockMsg('m1', 'Hi', myUrn)];
      vi.mocked(service.loadContext).mockResolvedValue({
        conversation: { id: chatUrn, name: 'Alpha' },
        messages,
        membershipStatus: 'joined',
        genesisReached: true,
        isRecipientKeyMissing: false,
        firstUnreadId: 'm1',
      } as any);

      await facade.loadConversation(chatUrn);

      expect(facade.selectedConversation()?.name).toBe('Alpha');
      expect(facade.messages()).toHaveLength(1);
      expect(facade.membershipStatus()).toBe('joined');
      expect(facade.firstUnreadId()).toBe('m1');
    });

    it('should reset state when loading null', async () => {
      await facade.loadConversation(null);
      expect(facade.selectedConversation()).toBeNull();
      expect(facade.messages()).toEqual([]);
    });
  });

  describe('Optimistic Actions', () => {
    it('sendMessage should update state immediately (Optimistic UI)', async () => {
      await facade.loadConversation(chatUrn);

      await facade.sendMessage(chatUrn, 'Hello World');

      // 1. Verify API Call
      expect(mockActions.sendMessage).toHaveBeenCalledWith(
        chatUrn,
        'Hello World',
      );

      // 2. Verify State (Snippet should be in the list)
      const msgs = facade.messages();
      expect(msgs).toHaveLength(1);
      expect(msgs[0].snippet).toBe('Hello World');
    });
  });

  describe('Reactive Ingestion (Smart Patching)', () => {
    it('should listen to ingestion and patch changed messages', async () => {
      // 1. Initial State
      await facade.loadConversation(chatUrn);
      const existingMsg = mockMsg('m1', 'Old', myUrn);
      // Hack to seed internal state for test
      (facade as any)._rawMessages.set([existingMsg]);

      // 2. Simulate Service returning updated data
      const updatedMsg = {
        ...existingMsg,
        snippet: 'Updated Content',
      };
      vi.mocked(service.fetchMessages).mockResolvedValue([updatedMsg] as any);

      // 3. Trigger Ingestion Event
      dataIngested$.next({
        messages: [],
        readReceipts: [],
        patchedMessageIds: ['m1'], // <-- The trigger
      });

      // 4. Wait for microtasks (Promise resolution)
      await Promise.resolve();

      // 5. Verify Patch
      expect(service.fetchMessages).toHaveBeenCalledWith(['m1']);
      const current = facade.messages();
      expect(current[0].snippet).toBe('Updated Content');
    });

    it('should ignore ingestion events for other conversations', async () => {
      await facade.loadConversation(chatUrn);

      // Trigger event with valid IDs but service returns data for a DIFFERENT chat
      const otherChatMsg = mockMsg('m99', 'Other', myUrn);
      otherChatMsg.conversationUrn = URN.parse('urn:messenger:group:bravo');

      vi.mocked(service.fetchMessages).mockResolvedValue([otherChatMsg]);

      dataIngested$.next({ messages: [{ id: 'm99' }] });
      await Promise.resolve();

      // Should NOT be added to current state
      expect(facade.messages()).toHaveLength(0);
    });
  });

  describe('Public API Delegation', () => {
    it('refreshMessages should force fetch specific IDs', async () => {
      await facade.loadConversation(chatUrn);

      await facade.refreshMessages(['m1', 'm2']);

      expect(service.fetchMessages).toHaveBeenCalledWith(['m1', 'm2']);
    });

    it('provisionNetworkGroup should delegate to GroupProtocol', async () => {
      const localUrn = URN.parse('urn:messenger:group:local');
      const result = await facade.provisionNetworkGroup(localUrn, 'New Group');

      expect(groupProtocol.provisionNetworkGroup).toHaveBeenCalledWith(
        localUrn,
        'New Group',
      );
      expect(result).toBe(chatUrn); // Returns mock result
    });
  });

  describe('Computed Logic: Read Cursors', () => {
    it('should calculate read cursors based on receiptMap', async () => {
      const bobUrn = URN.parse('urn:contacts:user:bob');
      const m1 = mockMsg('m1', 'Hi', myUrn);
      m1.receiptMap = { [bobUrn.toString()]: 'read' };

      await facade.loadConversation(chatUrn);
      (facade as any)._rawMessages.set([m1]);

      const cursors = facade.readCursors();
      expect(cursors.has('m1')).toBe(true);
      expect(cursors.get('m1')![0].toString()).toBe(bobUrn.toString());
    });
  });
});
