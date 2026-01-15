import { TestBed } from '@angular/core/testing';
import { MessageViewMapper } from './message-view.mapper';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockProvider } from 'ng-mocks';

describe('MessageViewMapper', () => {
  let mapper: MessageViewMapper;

  const mockBaseMsg: ChatMessage = {
    id: 'msg-1',
    conversationUrn: URN.parse('urn:messenger:group:1'),
    senderId: URN.parse('urn:contacts:user:1'),
    sentTimestamp: '2024-01-01T12:00:00Z' as any,
    status: 'read',
    typeId: MessageTypeText,
    payloadBytes: new Uint8Array([]),
    tags: [],
    textContent: undefined,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MessageViewMapper, MockProvider(Logger)],
    });

    mapper = TestBed.inject(MessageViewMapper);
  });

  it('should decode valid UTF-8 text payloads', () => {
    const text = 'Hello 🌍';
    const payload = new TextEncoder().encode(text);
    const msg = { ...mockBaseMsg, payloadBytes: payload };

    const result = mapper.toView(msg);

    expect(result.textContent).toBe(text);
    expect(result.payloadBytes).toEqual(payload);
  });

  it('should be idempotent (return as-is if textContent exists)', () => {
    const msg = { ...mockBaseMsg, textContent: 'Already Decoded' };
    const spy = vi.spyOn(TextDecoder.prototype, 'decode');

    const result = mapper.toView(msg);

    expect(result.textContent).toBe('Already Decoded');
    expect(spy).not.toHaveBeenCalled();
  });

  // ✅ NEW: Malformed UTF-8 Test
  it('should handle malformed UTF-8 gracefully (replace with )', () => {
    // 0xFF is an invalid byte in UTF-8
    const malformedPayload = new Uint8Array([0xff, 0xff]);
    const msg = { ...mockBaseMsg, payloadBytes: malformedPayload };

    const result = mapper.toView(msg);

    // 1. Ensure we actually got a string back
    expect(result.textContent).toBeDefined();

    // 2. Check for the "Replacement Character" () using a string literal
    expect(result.textContent).toContain('');

    // 3. Ensure it didn't fall back to the error string
    expect(result.textContent).not.toBe('[Error: Unreadable message]');
  });
});
