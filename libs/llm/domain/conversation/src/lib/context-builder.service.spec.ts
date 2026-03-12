import { TestBed } from '@angular/core/testing';
import { LlmContextBuilderService } from './context-builder.service';
import {
  MessageStorageService,
  ProposalRegistryStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  LlmSession,
  LlmMessage,
  FileLinkType,
  PointerPayload,
  RegistryEntry,
} from '@nx-platform-application/llm-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LlmContextBuilderService', () => {
  let service: LlmContextBuilderService;

  const mockMessageStorageService = { getSessionMessages: vi.fn() };
  const mockRegistryService = { getProposal: vi.fn() };
  const mockCacheService = { getValidCache: vi.fn() };
  const mockDataSources = { dataGroups: vi.fn().mockReturnValue([]) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LlmContextBuilderService,
        { provide: MessageStorageService, useValue: mockMessageStorageService },
        {
          provide: ProposalRegistryStorageService,
          useValue: mockRegistryService,
        },
        { provide: CompiledCacheService, useValue: mockCacheService },
        { provide: DataSourcesService, useValue: mockDataSources },
      ],
    });
    service = TestBed.inject(LlmContextBuilderService);
  });

  // ... (Keep existing lightweight pointer test exactly the same) ...
  it('should join lightweight pointers with registry status securely', async () => {
    const encoder = new TextEncoder();

    const pointer: PointerPayload = {
      proposalId: URN.parse('urn:llm:proposal:123'),
      filePath: 'src/main.ts',
      snippet: '+ new line',
    };

    const mockMessages: Partial<LlmMessage>[] = [
      {
        id: URN.parse('urn:llm:message:1'),
        role: 'user',
        typeId: URN.parse('urn:llm:message-type:text'),
        payloadBytes: encoder.encode('Fix this'),
        timestamp: '2026-02-27T10:00:00Z' as ISODateTimeString,
        isExcluded: false,
      },
      {
        id: URN.parse('urn:llm:message:2'),
        role: 'model',
        typeId: FileLinkType,
        payloadBytes: encoder.encode(JSON.stringify(pointer)),
        timestamp: '2026-02-27T10:01:00Z' as ISODateTimeString,
        isExcluded: false,
      },
    ];
    mockMessageStorageService.getSessionMessages.mockResolvedValue(
      mockMessages,
    );

    const mockRegistryEntry: Partial<RegistryEntry> = {
      id: URN.parse('urn:llm:proposal:123'),
      filePath: 'src/main.ts',
      status: 'accepted',
    };
    mockRegistryService.getProposal.mockResolvedValue(mockRegistryEntry);

    const mockSession: LlmSession = {
      id: URN.parse('urn:llm:session:123'),
      title: 'Test',
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      inlineContexts: [],
      systemContexts: [],
    };

    const assembly = await service.buildStreamRequest(mockSession);

    expect(mockRegistryService.getProposal).toHaveBeenCalledWith(
      pointer.proposalId,
    );
    expect(assembly.request.history[1].content).toContain(
      '[System Note: You proposed a modification for src/main.ts. The user has marked this proposal as: ACCEPTED.]',
    );
  });

  // ... (Keep Quick Context Window test exactly the same) ...
  it('should successfully inject the Quick Context Drawer payload with XML framing', async () => {
    const encoder = new TextEncoder();
    const mockMessages: Partial<LlmMessage>[] = [
      {
        id: URN.parse('urn:llm:message:1'),
        role: 'user',
        typeId: URN.parse('urn:llm:message-type:text'),
        payloadBytes: encoder.encode('Hello'),
        timestamp: '2026-02-27T10:00:00Z' as ISODateTimeString,
        isExcluded: false,
      },
    ];
    mockMessageStorageService.getSessionMessages.mockResolvedValue(
      mockMessages,
    );

    const mockSession: LlmSession = {
      id: URN.parse('urn:llm:session:123'),
      title: 'Test',
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      inlineContexts: [],
      quickContext: [
        {
          id: URN.parse('urn:llm:quick:1'),
          name: 'focused-file.ts',
          content: 'export const X = 1;',
        },
      ],
    };

    const assembly = await service.buildStreamRequest(mockSession);
    const firstMessageContent = assembly.request.history[0].content;

    expect(firstMessageContent).toContain('<CURRENT_ACTIVE_FOCUS>');
    expect(firstMessageContent).toContain('</CURRENT_ACTIVE_FOCUS>');
    expect(firstMessageContent).toContain(
      'Prioritize this code over the broader repository cache',
    );
    expect(firstMessageContent).toContain('<file name="focused-file.ts">');
  });

  it('should properly JIT unroll intent buckets and inject valid cache IDs', async () => {
    const encoder = new TextEncoder();
    const mockMessages: Partial<LlmMessage>[] = [
      {
        id: URN.parse('urn:llm:message:1'),
        role: 'user',
        typeId: URN.parse('urn:llm:message-type:text'),
        payloadBytes: encoder.encode('Hello'),
        timestamp: '2026-02-27T10:00:00Z' as ISODateTimeString,
        isExcluded: false,
      },
    ];
    mockMessageStorageService.getSessionMessages.mockResolvedValue(
      mockMessages,
    );

    // Mock a warm cache hit
    mockCacheService.getValidCache.mockReturnValue({
      id: URN.parse('urn:gemini:compiled-cache:hit'),
    });

    const mockSession: LlmSession = {
      id: URN.parse('urn:llm:session:123'),
      title: 'Test',
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      llmModel: 'gemini-1.5-pro',
      compiledContext: {
        id: URN.parse('urn:llm:attachment:cache-intent'),
        resourceUrn: URN.parse('urn:data-source:repo:1'),
        resourceType: 'source',
      },
      inlineContexts: [
        {
          id: URN.parse('urn:llm:attachment:inline-intent'),
          resourceUrn: URN.parse('urn:data-source:repo:2'),
          resourceType: 'source',
        },
      ],
    };

    const assembly = await service.buildStreamRequest(mockSession);

    expect(assembly.request.model).toBe('gemini-1.5-pro');
    expect(mockCacheService.getValidCache).toHaveBeenCalled();
    expect(assembly.request.compiledCacheId?.toString()).toBe(
      'urn:gemini:compiled-cache:hit',
    );
    expect(assembly.request.inlineAttachments?.length).toBe(1);
    expect(
      assembly.request.inlineAttachments?.[0].dataSourceId.toString(),
    ).toBe('urn:data-source:repo:2');
  });

  it('should unroll system intent buckets and inject them into the first history message', async () => {
    const encoder = new TextEncoder();
    const mockMessages: Partial<LlmMessage>[] = [
      {
        id: URN.parse('urn:llm:message:1'),
        role: 'user',
        typeId: URN.parse('urn:llm:message-type:text'),
        payloadBytes: encoder.encode('Hello'),
        timestamp: '2026-02-27T10:00:00Z' as ISODateTimeString,
        isExcluded: false,
      },
    ];
    mockMessageStorageService.getSessionMessages.mockResolvedValue(
      mockMessages,
    );

    const mockSession: LlmSession = {
      id: URN.parse('urn:llm:session:123'),
      title: 'Test',
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      systemContexts: [
        {
          id: URN.parse('urn:llm:attachment:sys-1'),
          resourceUrn: URN.parse('urn:data-source:repo:behavior-rules'),
          resourceType: 'source',
        },
      ],
      inlineContexts: [],
    };

    const assembly = await service.buildStreamRequest(mockSession);
    const firstMessage = assembly.request.history[0];

    expect(firstMessage.content).toContain('[SYSTEM_INSTRUCTIONS]');
    expect(firstMessage.content).toContain('behavior-rules');
    expect(firstMessage.content).toContain('Hello'); // Original text preserved
  });
});
