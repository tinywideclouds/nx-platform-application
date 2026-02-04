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
  TextContent,
  MessageTypeText,
} from '@nx-platform-application/messenger-domain-message-content';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ConversationActionService', () => {
  let service: ConversationActionService;
  let outbound: OutboundService;
  let conversationState: ConversationService;

  const mockUrn = URN.parse('urn:contacts:user:me');
  const recipientUrn = URN.parse('urn:contacts:user:bob');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConversationActionService,
        MockProvider(OutboundService, {
          // Mock the specific method used by the service
          sendFromConversation: vi.fn().mockResolvedValue({
            message: { id: 'msg-1' } as any,
            outcome: Promise.resolve('sent'),
          }),
        }),
        MockProvider(ConversationService, {
          upsertMessages: vi.fn(),
          updateMessageStatusInSignal: vi.fn(),
          selectedConversation: signal({
            id: recipientUrn,
            name: 'Bob',
            conversationUrn: recipientUrn,
          } as any),
        }),
      ],
    });

    service = TestBed.inject(ConversationActionService);
    outbound = TestBed.inject(OutboundService);
    conversationState = TestBed.inject(ConversationService);
  });

  it('should delegate sendMessage (Text) as an Object payload', async () => {
    await service.sendMessage(recipientUrn, 'Hello');

    const calls = vi.mocked(outbound.sendFromConversation).mock.calls;
    expect(calls).toHaveLength(1);
    const [to, type, payload] = calls[0];

    expect(to.toString()).toBe(recipientUrn.toString());
    expect(type.toString()).toBe(MessageTypeText.toString());

    // ✅ VERIFY: Payload is the Object, not bytes
    expect(payload).toEqual({ kind: 'text', text: 'Hello' } as TextContent);

    expect(conversationState.upsertMessages).toHaveBeenCalled();
  });

  it('should delegate sendImage as an Object payload', async () => {
    const imageData: ImageContent = {
      kind: 'image',
      inlineImage: 'data:abc',
      mimeType: 'image/png',
      width: 100,
      height: 100,
      sizeBytes: 1024,
    } as any;

    await service.sendImage(recipientUrn, imageData);

    const calls = vi.mocked(outbound.sendFromConversation).mock.calls;
    expect(calls).toHaveLength(1);
    const [to, type, payload] = calls[0];

    expect(to.toString()).toBe(recipientUrn.toString());
    expect(type.toString()).toBe(MessageTypeImage.toString());

    // ✅ VERIFY: Payload is the Object
    expect(payload).toBe(imageData);
  });

  it('should delegate typing indicator as Bytes (Signal)', async () => {
    await service.sendTypingIndicator(recipientUrn);

    const calls = vi.mocked(outbound.sendFromConversation).mock.calls;
    expect(calls).toHaveLength(1);
    const args = calls[0];

    // Check Type
    expect(args[1].toString()).toBe(MessageTypingIndicator.toString());

    // Check Payload is empty bytes
    expect(args[2]).toBeInstanceOf(Uint8Array);

    // Check Ephemeral Flag
    expect(args[3]).toEqual(expect.objectContaining({ isEphemeral: true }));
  });
});
