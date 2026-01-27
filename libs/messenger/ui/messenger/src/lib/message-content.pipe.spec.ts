import { MessageContentPipe } from './message-content.pipe';
import { TestBed } from '@angular/core/testing';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('MessageContentPipe', () => {
  let pipe: MessageContentPipe;
  let parser: MessageContentParser;

  const mockMsg: ChatMessage = {
    id: 'msg-1',
    conversationUrn: URN.parse('urn:messenger:group:1'),
    senderId: URN.parse('urn:contacts:user:alice'),
    sentTimestamp: '2023-01-01T00:00:00Z',
    typeId: URN.parse('urn:message:content:group-invite-response'),
    payloadBytes: new Uint8Array([1, 2, 3]),
  } as ChatMessage;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MessageContentPipe,
        MockProvider(MessageContentParser, {
          parse: vi.fn(),
        }),
      ],
    });

    pipe = TestBed.inject(MessageContentPipe);
    parser = TestBed.inject(MessageContentParser);
  });

  it('should return null if message has no payloadBytes', () => {
    const emptyMsg = { ...mockMsg, payloadBytes: undefined };
    expect(pipe.transform(emptyMsg)).toBeNull();
  });

  describe('System Messages (Group)', () => {
    it('should map "joined" status to correct system display', () => {
      // Mock the Domain Parser Response
      vi.mocked(parser.parse).mockReturnValue({
        kind: 'content',
        conversationId: mockMsg.conversationUrn,
        tags: [],
        payload: {
          kind: 'group-system',
          data: {
            groupUrn: 'urn:messenger:group:1',
            status: 'joined',
            timestamp: '...',
          },
        },
      } as any);

      const result = pipe.transform(mockMsg);

      expect(result).not.toBeNull();
      expect(result?.kind).toBe('system');
      expect(result?.system).toEqual({
        text: 'joined the group',
        icon: 'login',
      });
    });

    it('should map "declined" status to correct system display', () => {
      // Mock the Domain Parser Response
      vi.mocked(parser.parse).mockReturnValue({
        kind: 'content',
        conversationId: mockMsg.conversationUrn,
        tags: [],
        payload: {
          kind: 'group-system',
          data: {
            groupUrn: 'urn:messenger:group:1',
            status: 'declined',
            timestamp: '...',
          },
        },
      } as any);

      const result = pipe.transform(mockMsg);

      expect(result?.kind).toBe('system');
      expect(result?.system).toEqual({
        text: 'declined the invite',
        icon: 'person_remove',
      });
    });
  });

  describe('Standard Content (Regression)', () => {
    it('should map text content correctly', () => {
      vi.mocked(parser.parse).mockReturnValue({
        kind: 'content',
        payload: { kind: 'text', text: 'Hello World' },
      } as any);

      const result = pipe.transform(mockMsg);

      expect(result?.kind).toBe('text');
      expect(result?.parts[0]).toEqual({
        type: 'text',
        content: 'Hello World',
      });
    });

    it('should map image content correctly', () => {
      vi.mocked(parser.parse).mockReturnValue({
        kind: 'content',
        payload: {
          kind: 'image',
          inlineImage: 'data:img',
          width: 100,
          height: 100,
          caption: 'Look!',
        },
      } as any);

      const result = pipe.transform(mockMsg);

      expect(result?.kind).toBe('image');
      expect(result?.image?.src).toBe('data:img');
      // Verify caption parsing
      expect(result?.parts[0]).toEqual({ type: 'text', content: 'Look!' });
    });
  });
});
