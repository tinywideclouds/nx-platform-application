import { TestBed } from '@angular/core/testing';
import { LlmScrollSource } from './llm-scroll.source';
import { MessageStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { URN } from '@nx-platform-application/platform-types';
import { LlmMemoryManagerService } from '@nx-platform-application/llm-domain-conversation';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LlmScrollSource', () => {
  let service: LlmScrollSource;
  let mockStorage: any;
  let mockMemoryManager: any;

  beforeEach(() => {
    mockStorage = {
      getSessionMessages: vi.fn().mockResolvedValue([]),
    };

    mockMemoryManager = {
      analyzeAndCompressDryRun: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        LlmScrollSource,
        { provide: MessageStorageService, useValue: mockStorage },
        { provide: LlmMemoryManagerService, useValue: mockMemoryManager },
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

    service.setSession(urn);

    TestBed.flushEffects();
    await new Promise(process.nextTick);

    expect(mockStorage.getSessionMessages).toHaveBeenCalledWith(urn);

    const contentItems = service.items().filter((i) => i.type === 'content');
    expect(contentItems).toHaveLength(1);
    expect(contentItems[0].layout.alignment).toBe('end');
  });

  it('should trigger the memory manager dry run when generating finishes', async () => {
    const msgId = URN.parse('urn:llm:message:99');
    const mockMsg = {
      id: msgId,
      role: 'assistant',
      timestamp: '2026-02-28T10:00:00Z',
      payloadBytes: new Uint8Array(),
    } as any;

    // Simulate an active stream
    service.setLoading(true);
    service.addMessage(mockMsg);

    TestBed.flushEffects();

    // Should NOT have triggered while streaming
    expect(mockMemoryManager.analyzeAndCompressDryRun).not.toHaveBeenCalled();

    // End the stream
    service.setLoading(false);
    TestBed.flushEffects();

    // SHOULD trigger now that generation is done
    expect(mockMemoryManager.analyzeAndCompressDryRun).toHaveBeenCalledWith(
      expect.arrayContaining([mockMsg]),
    );
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

    const item = service
      .items()
      .find((i) => i.type === 'content' && (i.data as any).id.equals(msgId));

    expect((item?.data as any).isExcluded).toBe(true);
  });
});
