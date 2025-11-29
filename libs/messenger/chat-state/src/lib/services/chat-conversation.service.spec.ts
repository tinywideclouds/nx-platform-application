import { TestBed } from '@angular/core/testing';
import { ChatConversationService } from './chat-conversation.service';
import { ChatMessageRepository } from '@nx-platform-application/chat-message-repository';
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

// --- Fixtures ---
const mockConvoUrn = URN.parse('urn:sm:user:bob');
const mockMyUrn = URN.parse('urn:sm:user:me');

// Helper to create simple messages
const createMsg = (id: string, time: string): ChatMessage => ({
  id,
  sentTimestamp: time as ISODateTimeString,
  conversationUrn: mockConvoUrn,
  senderId: mockMyUrn,
  textContent: `Message ${id}`,
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new Uint8Array(),
});

describe('ChatConversationService', () => {
  let service: ChatConversationService;
  let repository: ChatMessageRepository;
  let keyService: ChatKeyService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatConversationService,
        MockProvider(ChatMessageRepository, {
          getMessages: vi.fn(),
        }),
        MockProvider(ChatKeyService, {
          checkRecipientKeys: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(ChatMessageMapper, {
          // Simple pass-through for the test view model
          toView: vi.fn((msg) => msg as any),
        }),
        MockProvider(ChatOutboundService),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ChatConversationService);
    repository = TestBed.inject(ChatMessageRepository);
    keyService = TestBed.inject(ChatKeyService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Message Ordering (Regression Tests)', () => {
    it('should maintain Chronological Order (Oldest -> Newest) on Initial Load', async () => {
      // 1. Setup: Repository returns messages ordered chronologically (Old -> New)
      // This mimics the storage layer behavior after the fix.
      const repoMessages = [
        createMsg('msg-1', '10:00'), // Oldest
        createMsg('msg-2', '10:05'),
        createMsg('msg-3', '10:10'), // Newest
      ];

      vi.spyOn(repository, 'getMessages').mockResolvedValue({
        messages: repoMessages as any,
        genesisReached: false,
      });

      // 2. Action
      await service.loadConversation(mockConvoUrn);

      // 3. Assert
      const currentMessages = service.messages();

      expect(currentMessages.length).toBe(3);

      // CRITICAL: Ensure index 0 is Oldest (Top of UI) and last index is Newest (Bottom of UI)
      // If the bug exists (double reverse), msg-3 would be at index 0.
      expect(currentMessages[0].id).toBe('msg-1');
      expect(currentMessages[2].id).toBe('msg-3');
    });

    it('should Prepend older messages correctly during Infinite Scroll', async () => {
      // 1. Setup: Service already has the "Newer" page
      const currentUIState = [
        createMsg('msg-3', '10:10'),
        createMsg('msg-4', '10:15'),
      ];
      // Manually set internal signal state (simulating previous load)
      (service.messages as any).set(currentUIState);
      (service.selectedConversation as any).set(mockConvoUrn);

      // 2. Setup: Repository returns the "Older" page
      // Repo returns [Msg 1, Msg 2] (Chronological)
      const olderPage = [
        createMsg('msg-1', '10:00'),
        createMsg('msg-2', '10:05'),
      ];

      vi.spyOn(repository, 'getMessages').mockResolvedValue({
        messages: olderPage as any,
        genesisReached: true,
      });

      // 3. Action
      await service.loadMoreMessages();

      // 4. Assert
      const result = service.messages();
      expect(result.length).toBe(4);

      // Order should be: [Older Page] + [Existing Page]
      // [msg-1, msg-2, msg-3, msg-4]
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
      expect(result[2].id).toBe('msg-3');
      expect(result[3].id).toBe('msg-4');
    });

    it('should Append new incoming messages to the bottom', () => {
      // 1. Setup: Existing history
      const history = [createMsg('old', '10:00')];
      (service.messages as any).set(history);
      (service.selectedConversation as any).set(mockConvoUrn);

      // 2. Action: New message arrives (e.g. from Websocket)
      const newMsg = createMsg('new', '10:01');
      service.upsertMessages([newMsg]);

      // 3. Assert
      const result = service.messages();
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('old');
      expect(result[1].id).toBe('new'); // Newest at bottom
    });
  });

  describe('Key Verification', () => {
    it('should flag missing keys on load', async () => {
      vi.spyOn(keyService, 'checkRecipientKeys').mockResolvedValue(false);

      await service.loadConversation(mockConvoUrn);

      expect(service.isRecipientKeyMissing()).toBe(true);
    });

    it('should clear missing key flag on valid load', async () => {
      vi.spyOn(keyService, 'checkRecipientKeys').mockResolvedValue(true);

      await service.loadConversation(mockConvoUrn);

      expect(service.isRecipientKeyMissing()).toBe(false);
    });
  });
});
