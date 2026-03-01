import { TestBed } from '@angular/core/testing';
import { LlmContextBuilderService } from './context-builder.service';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmSession, LlmMessage } from '@nx-platform-application/llm-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LlmContextBuilderService', () => {
  let service: LlmContextBuilderService;

  const mockStorageService = {
    getSessionMessages: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LlmContextBuilderService,
        { provide: LlmStorageService, useValue: mockStorageService },
      ],
    });
    service = TestBed.inject(LlmContextBuilderService);
  });

  it('should bundle the stream request with correct cache IDs and inline attachments', async () => {
    // 1. Setup Mock DB Messages
    const encoder = new TextEncoder();
    const mockMessages: Partial<LlmMessage>[] = [
      {
        id: URN.parse('urn:llm:message:1'), // FIX: 4-part URN
        role: 'user',
        payloadBytes: encoder.encode('Hello'),
        timestamp: '2026-02-27T10:00:00Z' as ISODateTimeString,
        isExcluded: false,
      },
    ];
    mockStorageService.getSessionMessages.mockResolvedValue(mockMessages);

    // 2. Setup Mock Session
    const mockSession: LlmSession = {
      id: URN.parse('urn:llm:session:123'), // FIX: 4-part URN
      title: 'Test',
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      llmModel: 'gemini-1.5-pro',
      geminiCache: 'cachedContents/abc', // AOT Cache
      attachments: [
        {
          id: 'att-1',
          target: 'gemini-cache',
          cacheId: URN.parse('urn:llm:repo:1'), // FIX: 4-part URN
        },
        {
          id: 'att-2',
          target: 'inline-context',
          cacheId: URN.parse('urn:llm:repo:2'), // FIX: 4-part URN
        }, // JIT Attachment
      ],
    };

    // 3. Execute
    const assembly = await service.buildStreamRequest(mockSession);

    // 4. Verify Request Payload
    expect(assembly.request.sessionId).toBe('urn:llm:session:123'); // FIX: Match 4-part URN
    expect(assembly.request.model).toBe('gemini-1.5-pro');
    expect(assembly.request.cacheId).toBe('cachedContents/abc');

    // Verify it only grabbed the inline-context target
    expect(assembly.request.inlineAttachments).toHaveLength(1);
    expect(assembly.request.inlineAttachments?.[0].cacheId).toBe(
      'urn:llm:repo:2',
    ); // FIX: Match 4-part URN
  });
});
