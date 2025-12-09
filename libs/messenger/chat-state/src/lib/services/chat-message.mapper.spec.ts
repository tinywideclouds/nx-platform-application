import { TestBed } from '@angular/core/testing';
import { ChatMessageMapper } from './chat-message.mapper';
import { Logger } from '@nx-platform-application/console-logger';
import { DecryptedMessage } from '@nx-platform-application/chat-storage';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };

const mockDecryptedMsg: DecryptedMessage = {
  messageId: 'msg-1',
  senderId: URN.parse('urn:contacts:user:sender'),
  recipientId: URN.parse('urn:contacts:user:me'),
  sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
  conversationUrn: URN.parse('urn:contacts:user:sender'),
  status: 'received',
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new TextEncoder().encode('Hello World'),
};

describe('ChatMessageMapper', () => {
  let service: ChatMessageMapper;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [ChatMessageMapper, { provide: Logger, useValue: mockLogger }],
    });
    service = TestBed.inject(ChatMessageMapper);
  });

  it('should map DecryptedMessage to ChatMessage correctly', () => {
    const result = service.toView(mockDecryptedMsg);

    expect(result.id).toBe('msg-1');
    expect(result.senderId.toString()).toBe('urn:contacts:user:sender');
    expect(result.textContent).toBe('Hello World');
    expect(result.sentTimestamp).toBe('2025-01-01T12:00:00Z');
    expect(result.typeId.toString()).toBe('urn:message:type:text');
  });

  it('should handle non-text messages gracefully', () => {
    const nonTextMsg = {
      ...mockDecryptedMsg,
      typeId: URN.parse('urn:message:type:image'),
      payloadBytes: new Uint8Array([0, 1, 2]),
    };

    const result = service.toView(nonTextMsg);

    expect(result.textContent).toBe('Unsupported Message Type');
    // Should preserve bytes for smart renderer
    expect(result.payloadBytes).toEqual(new Uint8Array([0, 1, 2]));
  });

  it('should handle malformed text gracefully', () => {
    const malformedMsg = {
      ...mockDecryptedMsg,
      // Invalid UTF-8 sequence that causes TextDecoder(fatal=true) to throw
      payloadBytes: new Uint8Array([0xff, 0xff]),
    };

    const result = service.toView(malformedMsg);

    expect(mockLogger.error).toHaveBeenCalled();
    expect(result.textContent).toContain('[Error: Unreadable message]');
  });
});
