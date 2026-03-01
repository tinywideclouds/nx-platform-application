import { TestBed } from '@angular/core/testing';
import { LlmScrollSource } from './llm-scroll.source';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LlmScrollSource', () => {
  let service: LlmScrollSource;
  let mockStorage: any;

  beforeEach(() => {
    mockStorage = {
      getSessionMessages: vi.fn().mockResolvedValue([]),
    };

    TestBed.configureTestingModule({
      providers: [
        LlmScrollSource,
        { provide: LlmStorageService, useValue: mockStorage },
      ],
    });

    service = TestBed.inject(LlmScrollSource);
  });

  it('should reactively fetch messages when the active session ID changes', async () => {
    const urn = URN.parse('urn:llm:session:123');
    mockStorage.getSessionMessages.mockResolvedValue([
      {
        id: URN.parse('urn:llm:message:1'),
        role: 'user',
        timestamp: '2026-02-28T10:00:00Z',
      },
    ]);

    // Set session, which triggers the effect
    service.setSession(urn);

    // In zoneless testing, we manually flush effects to resolve the promise
    TestBed.flushEffects();
    await new Promise(process.nextTick);

    expect(mockStorage.getSessionMessages).toHaveBeenCalledWith(urn);

    // Filter out date headers to check just the content
    const contentItems = service.items().filter((i) => i.type === 'content');
    expect(contentItems).toHaveLength(1);
    expect(contentItems[0].layout.alignment).toBe('end'); // user role maps to 'end'
  });

  it('should update message payload bytes via signal mutation', () => {
    const msgId = URN.parse('urn:llm:message:99');
    service.addMessage({
      id: msgId,
      role: 'assistant',
      timestamp: '2026-02-28T10:00:00Z',
      payloadBytes: new Uint8Array(),
    } as any);

    const newBytes = new Uint8Array([1, 2, 3]);
    service.updateMessagePayload(msgId, newBytes);

    // FIX: Safely find the content item and cast it so TypeScript knows it has an 'id'
    const item = service
      .items()
      .find((i) => i.type === 'content' && (i.data as any).id.equals(msgId));

    expect((item?.data as any).payloadBytes).toEqual(newBytes);
  });

  it('should accurately apply exclusions to specific messages', () => {
    const msgId = URN.parse('urn:llm:message:55');
    service.addMessage({
      id: msgId,
      role: 'user',
      timestamp: '2026-02-28T10:00:00Z',
      isExcluded: false,
    } as any);

    service.updateMessageExclusions([msgId], true);

    // FIX: Safely find the content item
    const item = service
      .items()
      .find((i) => i.type === 'content' && (i.data as any).id.equals(msgId));

    expect((item?.data as any).isExcluded).toBe(true);
  });
});
