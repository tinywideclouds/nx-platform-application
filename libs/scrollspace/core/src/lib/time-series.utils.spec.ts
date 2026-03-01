import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';
import { TimeSeries } from './time-series.utils';
import { describe, it, expect } from 'vitest';

describe('TimeSeries', () => {
  const mockOptions = {
    getTimestamp: (item: any) => Temporal.Instant.from(item.timestamp),
    getActorId: (item: any) => item.actorId,
    getAlignment: (item: any) => item.align,
    timeZone: 'UTC',
  };

  it('should inject a date header when dates change', () => {
    const rawItems = [
      {
        id: URN.parse('urn:app:test:1'),
        timestamp: '2026-02-28T10:00:00Z',
        actorId: 'user1',
        align: 'end',
      },
      {
        id: URN.parse('urn:app:test:2'),
        timestamp: '2026-03-01T10:00:00Z',
        actorId: 'user1',
        align: 'end',
      }, // Next day
    ];

    const result = TimeSeries.transform(rawItems, mockOptions as any);

    // Expected: Date Header (Feb 28), Item 1, Date Header (Mar 1), Item 2
    expect(result).toHaveLength(4);
    expect(result[0].type).toBe('date-header');
    expect(result[1].type).toBe('content');
    expect(result[2].type).toBe('date-header');
    expect(result[3].type).toBe('content');
  });

  it('should accurately flag continuous items from the same actor', () => {
    const rawItems = [
      {
        id: URN.parse('urn:app:test:1'),
        timestamp: '2026-02-28T10:00:00Z',
        actorId: 'user1',
        align: 'end',
      },
      {
        id: URN.parse('urn:app:test:2'),
        timestamp: '2026-02-28T10:01:00Z',
        actorId: 'user1',
        align: 'end',
      }, // Same actor
      {
        id: URN.parse('urn:app:test:3'),
        timestamp: '2026-02-28T10:02:00Z',
        actorId: 'bot',
        align: 'start',
      }, // Different actor
    ];

    const result = TimeSeries.transform(rawItems, mockOptions as any);

    // Filter to just content items
    const content = result.filter((r) => r.type === 'content');

    expect(content[0].layout.isContinuous).toBe(false);
    expect(content[1].layout.isContinuous).toBe(true); // Same actor as previous
    expect(content[2].layout.isContinuous).toBe(false); // New actor
  });
});
