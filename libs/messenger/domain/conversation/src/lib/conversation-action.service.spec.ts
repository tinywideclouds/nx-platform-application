import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ConversationActionService } from './conversation-action.service';
import { ConversationService } from './conversation.service';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { URN } from '@nx-platform-application/platform-types';
import {
  MessageTypingIndicator,
  ImageContent,
  MessageTypeImage, // ✅ NEW
} from '@nx-platform-application/messenger-domain-message-content';
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
    expect(conversationState.upsertMessages).toHaveBeenCalled();
  });

  // ✅ NEW TEST
  it('should delegate sendImage to OutboundService with correct type', async () => {
    const imageData: ImageContent = {
      kind: 'image',
      thumbnailBase64: 'data:abc',
      remoteUrl: 'pending',
      decryptionKey: 'none',
      mimeType: 'image/png',
      width: 100,
      height: 100,
      sizeBytes: 1024,
    };

    await service.sendImage(recipientUrn, imageData, mockKeys, mockUrn);

    expect(outbound.sendMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      // Verify correct URN
      MessageTypeImage,
      // Verify payload is JSON stringified
      expect.any(Uint8Array),
      undefined, // Not ephemeral
    );

    // Verify content decoding for strict correctness
    const callArgs = vi.mocked(outbound.sendMessage).mock.calls[0];
    const bytes = callArgs[4] as Uint8Array;
    const decoded = JSON.parse(new TextDecoder().decode(bytes));
    expect(decoded.kind).toBe('image');
    expect(decoded.remoteUrl).toBe('pending');
  });

  it('should delegate typing indicator to OutboundService', async () => {
    await service.sendTypingIndicator(mockKeys, mockUrn);

    expect(outbound.sendMessage).toHaveBeenCalledWith(
      expect.anything(), // keys
      expect.anything(), // sender
      expect.anything(), // recipient
      MessageTypingIndicator,
      expect.anything(), // payload
      expect.objectContaining({ isEphemeral: true }),
    );
  });
});
