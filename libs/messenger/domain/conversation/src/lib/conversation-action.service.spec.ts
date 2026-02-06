import { TestBed } from '@angular/core/testing';
import { ConversationActionService } from './conversation-action.service';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ConversationActionService', () => {
  let service: ConversationActionService;
  let outbound: OutboundService;
  let storage: ChatStorageService;

  const recipientUrn = URN.parse('urn:contacts:user:bob');

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        ConversationActionService,
        MockProvider(OutboundService, {
          sendFromConversation: vi.fn().mockResolvedValue({
            message: { id: 'msg-1' } as any,
            outcome: Promise.resolve('sent'),
          }),
        }),
        MockProvider(ChatStorageService, {
          markMessagesAsRead: vi.fn().mockResolvedValue(undefined),
        }),
      ],
    });

    service = TestBed.inject(ConversationActionService);
    outbound = TestBed.inject(OutboundService);
    storage = TestBed.inject(ChatStorageService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sendMessage', () => {
    it('should delegate sendMessage (Text) and reset throttle', async () => {
      await service.sendTypingIndicator(recipientUrn);
      expect(outbound.sendFromConversation).toHaveBeenCalledTimes(1);

      await service.sendMessage(recipientUrn, 'Hello');

      // Should allow immediate typing again
      await service.sendTypingIndicator(recipientUrn);
      expect(outbound.sendFromConversation).toHaveBeenCalledTimes(3);
    });
  });

  describe('sendTypingIndicator', () => {
    it('should throttle outgoing indicators', async () => {
      await service.sendTypingIndicator(recipientUrn);
      await service.sendTypingIndicator(recipientUrn); // Dropped
      expect(outbound.sendFromConversation).toHaveBeenCalledTimes(1);

      // Advance clock past the 3s throttle window
      await vi.advanceTimersByTimeAsync(3001);

      await service.sendTypingIndicator(recipientUrn);
      expect(outbound.sendFromConversation).toHaveBeenCalledTimes(2);
    });
  });

  describe('markMessagesAsRead', () => {
    it('should batch network requests via auditTime', async () => {
      const ids1 = ['msg-1', 'msg-2'];

      // 1. Trigger Action
      service.markMessagesAsRead(recipientUrn, ids1);

      // Local storage hit immediately
      expect(storage.markMessagesAsRead).toHaveBeenCalledWith(
        recipientUrn,
        ids1,
      );

      // Network NOT hit yet (waiting for auditTime)
      expect(outbound.sendFromConversation).not.toHaveBeenCalled();

      // 2. Advance Time and await async resolution
      await vi.advanceTimersByTimeAsync(1100);

      // 3. Network hit ONCE
      expect(outbound.sendFromConversation).toHaveBeenCalledTimes(1);
    });
  });
});
