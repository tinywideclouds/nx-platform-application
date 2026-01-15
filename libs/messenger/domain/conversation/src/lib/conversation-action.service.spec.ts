import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ConversationActionService } from './conversation-action.service';
import { ConversationService } from './conversation.service';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { URN } from '@nx-platform-application/platform-types';
import {
  MessageTypingIndicator,
  ImageContent,
  MessageTypeImage,
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

  it('should delegate sendImage to OutboundService with correct type and payload', async () => {
    // ✅ FIX: Use updated ImageContent interface (inlineImage)
    const imageData: ImageContent = {
      kind: 'image',
      inlineImage: 'data:abc', // Replaces thumbnailBase64
      remoteUrl: 'pending', // Optional but good for testing
      decryptionKey: 'none',
      mimeType: 'image/png',
      width: 100,
      height: 100,
      sizeBytes: 1024,
    } as any; // Cast to satisfy partial mock if needed, or strictly match interface

    await service.sendImage(recipientUrn, imageData, mockKeys, mockUrn);

    // Capture the arguments from the first call
    const calls = vi.mocked(outbound.sendMessage).mock.calls;
    expect(calls).toHaveLength(1);
    const args = calls[0];

    // Arg 2: Recipient
    expect(args[2].toString()).toBe(recipientUrn.toString());

    // Arg 3: Type ID (Image) - ✅ FIX: Compare URN strings
    expect(args[3].toString()).toBe(MessageTypeImage.toString());

    // Arg 4: Payload (Uint8Array)
    const payloadBytes = args[4] as Uint8Array;

    // If this is undefined or not a buffer, the TextDecoder below will fail.
    expect(payloadBytes).toBeDefined();

    // Verify Payload Content (Decode JSON)
    const decoded = JSON.parse(new TextDecoder().decode(payloadBytes));
    expect(decoded.kind).toBe('image');
    expect(decoded.inlineImage).toBe('data:abc');
    expect(decoded.width).toBe(100);

    // Arg 5: Options (undefined for standard messages)
    expect(args[5]).toBeUndefined();
  });

  it('should delegate typing indicator to OutboundService as ephemeral', async () => {
    await service.sendTypingIndicator(recipientUrn, mockKeys, mockUrn);

    const calls = vi.mocked(outbound.sendMessage).mock.calls;
    expect(calls).toHaveLength(1);
    const args = calls[0];

    // Check Type - ✅ FIX: Use URN constant
    expect(args[3].toString()).toBe(MessageTypingIndicator.toString());

    // Check Ephemeral Flag
    expect(args[5]).toEqual(expect.objectContaining({ isEphemeral: true }));
  });
});
