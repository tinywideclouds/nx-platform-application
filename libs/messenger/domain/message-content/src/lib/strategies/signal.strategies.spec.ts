import { TestBed } from '@angular/core/testing';
import { URN } from '@nx-platform-application/platform-types';
import { SignalParserStrategy } from './signal.strategies';
import { MessageTypeReadReceipt } from '../models/content-types';

describe('SignalParserStrategy', () => {
  let strategy: SignalParserStrategy;
  const encoder = new TextEncoder();

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SignalParserStrategy] });
    strategy = TestBed.inject(SignalParserStrategy);
  });

  it('should parse read receipts and preserve conversation context', () => {
    const data = { messageIds: ['1', '2'], readAt: '2024-01-01' };
    const bytes = encoder.encode(JSON.stringify(data));
    const mockContext = {
      conversationId: URN.parse('urn:group:1'),
      tags: [],
    };

    const result = strategy.parse(MessageTypeReadReceipt, bytes, mockContext);

    expect(result.kind).toBe('signal');
    if (result.kind === 'signal') {
      expect(result.payload.action).toBe('read-receipt');
      expect(result.payload.data).toEqual(data);
      // [UPDATE] Verify context propagation
      expect(result.conversationId).toEqual(mockContext.conversationId);
    }
  });
});
