import { TestBed } from '@angular/core/testing';
import { LlmContextBuilderService } from './context-builder.service';
import {
  MessageStorageService,
  ProposalRegistryStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';
import { LlmDigestService } from '@nx-platform-application/llm-domain-digest';
import { DataSourceResolver } from '@nx-platform-application/llm-features-workspace';
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
  const mockRegistryService = { getProposalsForSession: vi.fn() };
  const mockCacheService = { getValidCache: vi.fn() };
  const mockDigestService = { getDigestsForSession: vi.fn() };
  const mockResolver = { resolve: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock returns
    mockDigestService.getDigestsForSession.mockResolvedValue([]);
    mockRegistryService.getProposalsForSession.mockResolvedValue([]);
    mockResolver.resolve.mockResolvedValue([]);

    TestBed.configureTestingModule({
      providers: [
        LlmContextBuilderService,
        { provide: MessageStorageService, useValue: mockMessageStorageService },
        {
          provide: ProposalRegistryStorageService,
          useValue: mockRegistryService,
        },
        { provide: CompiledCacheService, useValue: mockCacheService },
        { provide: LlmDigestService, useValue: mockDigestService },
        { provide: DataSourceResolver, useValue: mockResolver },
      ],
    });
    service = TestBed.inject(LlmContextBuilderService);
  });

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
    mockRegistryService.getProposalsForSession.mockResolvedValue([
      mockRegistryEntry,
    ]);

    const mockSession: LlmSession = {
      id: URN.parse('urn:llm:session:123'),
      title: 'Test',
      llmModel: 'gemini',
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      inlineContexts: [],
      systemContexts: [],
    };

    const assembly = await service.buildStreamRequest(mockSession);

    expect(mockRegistryService.getProposalsForSession).toHaveBeenCalledWith(
      mockSession.id,
    );
    expect(assembly.request.history[1].content).toContain(
      '[System Note: Assistant proposed a modification for src/main.ts. Status: ACCEPTED.]',
    );
  });

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
      llmModel: 'gemini',
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

    // Mock the resolver mapping Intents to pure URNs
    mockResolver.resolve.mockImplementation(async (intent: any) => {
      if (intent.id.equals(URN.parse('urn:llm:attachment:cache-intent'))) {
        return [URN.parse('urn:datasource:stream:1')];
      }
      if (intent.id.equals(URN.parse('urn:llm:attachment:inline-intent'))) {
        return [URN.parse('urn:datasource:stream:2')];
      }
      return [];
    });

    const mockSession: LlmSession = {
      id: URN.parse('urn:llm:session:123'),
      title: 'Test',
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      llmModel: 'gemini-1.5-pro',
      compiledContext: {
        id: URN.parse('urn:llm:attachment:cache-intent'),
        resourceUrn: URN.parse('urn:datasource:group:group-1'),
        resourceType: 'group',
      },
      inlineContexts: [
        {
          id: URN.parse('urn:llm:attachment:inline-intent'),
          resourceUrn: URN.parse('urn:datasource:stream:2'),
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

    // Now asserts against the pure URN we mapped in the builder
    expect(
      assembly.request.inlineAttachments?.[0].dataSourceId.toString(),
    ).toBe('urn:datasource:stream:2');
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

    mockResolver.resolve.mockResolvedValue([
      URN.parse('urn:datasource:stream:behavior-rules'),
    ]);

    const mockSession: LlmSession = {
      id: URN.parse('urn:llm:session:123'),
      title: 'Test',
      llmModel: 'gemini',
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      systemContexts: [
        {
          id: URN.parse('urn:llm:attachment:sys-1'),
          resourceUrn: URN.parse('urn:datasource:stream:behavior-rules'),
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
