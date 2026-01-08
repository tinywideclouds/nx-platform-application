import { TestBed } from '@angular/core/testing';
import { URN } from '@nx-platform-application/platform-types';
import { SignalParserStrategy } from './signal.strategies';
import { MESSAGE_TYPE_READ_RECEIPT } from '../models/content-types';

describe('SignalParserStrategy', () => {
  let strategy: SignalParserStrategy;
  const encoder = new TextEncoder();

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SignalParserStrategy] });
    strategy = TestBed.inject(SignalParserStrategy);
  });

  it('should parse read receipts', () => {
    const data = { messageIds: ['1', '2'], readAt: '2024-01-01' };
    const bytes = encoder.encode(JSON.stringify(data));

    const result = strategy.parse(URN.parse(MESSAGE_TYPE_READ_RECEIPT), bytes, {
      tags: [],
    });

    expect(result.kind).toBe('signal');
    if (result.kind === 'signal') {
      expect(result.payload.action).toBe('read-receipt');
      expect(result.payload.data).toEqual(data);
    }
  });
});
