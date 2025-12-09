// libs/messenger/chat-state/src/lib/services/chat-conversation.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { ChatConversationService } from './chat-conversation.service';
import { ChatMessageRepository } from '@nx-platform-application/chat-message-repository';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ChatKeyService } from './chat-key.service';
import { ChatMessageMapper } from './chat-message.mapper';
import { ChatOutboundService } from './chat-outbound.service';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { PrivateKeys } from '@nx-platform-application/messenger-crypto-bridge';

// --- Fixtures ---
const mockConvoUrn = URN.parse('urn:contacts:user:bob');
const mockMyUrn = URN.parse('urn:contacts:user:me');
const mockKeys: PrivateKeys = { encKey: 'k1' } as any;

const createMsg = (id: string, time: string): ChatMessage => ({
  id,
  sentTimestamp: time as ISODateTimeString,
  conversationUrn: mockConvoUrn,
  senderId: mockMyUrn,
  textContent: `Message ${id}`,
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new Uint8Array(),
});

describe('ChatConversationService', () => {
  let service: ChatConversationService;
  let repository: ChatMessageRepository;
  let storageService: ChatStorageService;
  let outboundService: ChatOutboundService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatConversationService,
        MockProvider(ChatMessageRepository, {
          getMessages: vi.fn(),
          getConversationSummaries: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(ChatStorageService, {
          markConversationAsRead: vi.fn().mockResolvedValue(undefined),
          getConversationIndex: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatKeyService, {
          checkRecipientKeys: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(ChatMessageMapper, {
          toView: vi.fn((msg) => msg as any),
        }),
        MockProvider(ChatOutboundService, {
          send: vi.fn().mockResolvedValue({ status: 'sent' }),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ChatConversationService);
    repository = TestBed.inject(ChatMessageRepository);
    storageService = TestBed.inject(ChatStorageService);
    outboundService = TestBed.inject(ChatOutboundService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading & Optimization', () => {
    it('should clear messages IMMEDIATELY upon loading new conversation', async () => {
      // 1. Setup: State has "Old" messages
      (service.messages as any).set([createMsg('old', '10:00')]);

      // 2. Setup: Repo will take some time
      vi.spyOn(repository, 'getMessages').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10)); // simulate delay
        return { messages: [], genesisReached: true };
      });

      // 3. Act: Load new conversation
      const loadPromise = service.loadConversation(mockConvoUrn);

      // 4. Assert: Messages should be empty immediately (before promise resolves)
      expect(service.messages().length).toBe(0);

      // 5. Cleanup
      await loadPromise;
    });

    it('should not clear messages if loading the SAME conversation', async () => {
      // 1. Setup
      (service.selectedConversation as any).set(mockConvoUrn);
      (service.messages as any).set([createMsg('old', '10:00')]);

      // 2. Act
      await service.loadConversation(mockConvoUrn);

      // 3. Assert: Should stay same (Optimization)
      expect(service.messages().length).toBe(1);
      expect(storageService.markConversationAsRead).toHaveBeenCalled();
    });
  });

  describe('Read Status & Boundary Logic', () => {
    it('should mark conversation as read when loaded', async () => {
      vi.spyOn(repository, 'getMessages').mockResolvedValue({
        messages: [],
        genesisReached: true,
      });

      await service.loadConversation(mockConvoUrn);

      expect(storageService.markConversationAsRead).toHaveBeenCalledWith(
        mockConvoUrn
      );
    });

    it('should set firstUnreadId when unreadCount > 0', async () => {
      vi.spyOn(storageService, 'getConversationIndex').mockResolvedValue({
        unreadCount: 2,
      } as any);

      // Repo returns 5 messages. indices 0,1,2,3,4.
      // Unread = 2. Boundary Index = 5 - 2 = 3.
      const msgs = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        sentTimestamp: '10:00',
      }));

      vi.spyOn(repository, 'getMessages').mockResolvedValue({
        messages: msgs.reverse() as any, // Repo returns newest first
        genesisReached: true,
      });

      await service.loadConversation(mockConvoUrn);

      // View messages are oldest first: msg-0, msg-1, msg-2, [msg-3, msg-4]
      expect(service.firstUnreadId()).toBe('msg-3');
    });
  });

  describe('Typing Indicators', () => {
    it('notifyTyping should trigger the typingTrigger$ subject', () => {
      let triggered = false;
      const sub = service.typingTrigger$.subscribe(() => {
        triggered = true;
      });

      // Should not trigger if no conversation selected
      service.notifyTyping();
      expect(triggered).toBe(false);

      // Select conversation
      (service.selectedConversation as any).set(mockConvoUrn);
      service.notifyTyping();
      expect(triggered).toBe(true);

      sub.unsubscribe();
    });

    it('sendTypingIndicator should call outbound with isEphemeral: true', async () => {
      (service.selectedConversation as any).set(mockConvoUrn);

      await service.sendTypingIndicator(mockKeys, mockMyUrn);

      expect(outboundService.send).toHaveBeenCalledWith(
        mockKeys,
        mockMyUrn,
        mockConvoUrn,
        expect.objectContaining({ entityId: 'type:typing-indicator' }), // Loose check on URN
        expect.any(Uint8Array), // Empty payload
        { isEphemeral: true } // ✅ Check Flag
      );
    });
  });

  describe('Live Updates', () => {
    it('should mark as read during upsert if conversation is ACTIVE', async () => {
      // 1. Setup: Conversation is active
      (service.selectedConversation as any).set(mockConvoUrn);

      // 2. Action: New message arrives for this conversation
      const newMsg = createMsg('new', '10:00');
      service.upsertMessages([newMsg]);

      // 3. Assert: Should mark as read
      expect(storageService.markConversationAsRead).toHaveBeenCalledWith(
        mockConvoUrn
      );
    });

    it('should NOT mark as read if DIFFERENT conversation is active', async () => {
      // 1. Setup: User is looking at Alice
      const aliceUrn = URN.parse('urn:contacts:user:alice');
      (service.selectedConversation as any).set(aliceUrn);

      // 2. Action: Message arrives for Bob
      const newMsg = createMsg('new', '10:00'); // Belonging to Bob
      service.upsertMessages([newMsg]);

      // 3. Assert
      expect(storageService.markConversationAsRead).not.toHaveBeenCalled();
    });
  });
});
