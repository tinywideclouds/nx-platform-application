import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ConversationActionService } from './conversation-action.service';
import { ConversationService } from './conversation.service';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { URN } from '@nx-platform-application/platform-types';
import { MESSAGE_TYPE_TYPING } from '@nx-platform-application/messenger-domain-message-content';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ConversationActionService', () => {
  let service: ConversationActionService;
  let outbound: OutboundService;
  let conversationState: ConversationService;

  const mockUrn = URN.parse('urn:contacts:user:me');
  const recipientUrn = URN.parse('urn:contacts:user:bob');
  const mockKeys = {} as PrivateKeys;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConversationActionService,
        MockProvider(OutboundService, {
          sendMessage: vi.fn().mockResolvedValue({
            message: { id: 'msg-1' } as any,
            outcome: Promise.resolve('sent'),
          }),
        }),
        MockProvider(ConversationService, {
          upsertMessages: vi.fn(),
          updateMessageStatusInSignal: vi.fn(),
          selectedConversation: signal(recipientUrn),
        }),
      ],
    });

    service = TestBed.inject(ConversationActionService);
    outbound = TestBed.inject(OutboundService);
    conversationState = TestBed.inject(ConversationService);
  });

  it('should delegate sendMessage to OutboundService', async () => {
    await service.sendMessage(recipientUrn, 'Hello', mockKeys, mockUrn);

    expect(outbound.sendMessage).toHaveBeenCalled();
    // Check optimistic update
    expect(conversationState.upsertMessages).toHaveBeenCalled();
  });

  it('should delegate typing indicator to OutboundService', async () => {
    await service.sendTypingIndicator(mockKeys, mockUrn);

    expect(outbound.sendMessage).toHaveBeenCalledWith(
      expect.anything(), // keys
      expect.anything(), // sender
      expect.anything(), // recipient
      // ✅ FIX: Match the exact URN object derived from the constant
      URN.parse(MESSAGE_TYPE_TYPING),
      expect.anything(), // payload
      expect.objectContaining({ isEphemeral: true }),
    );
  });
});
