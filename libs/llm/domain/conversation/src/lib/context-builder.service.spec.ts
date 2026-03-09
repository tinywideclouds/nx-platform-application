import { TestBed } from '@angular/core/testing';
import { LlmContextBuilderService } from './context-builder.service';
import {
  MessageStorageService,
  ProposalRegistryStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
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

  const mockMessageStorageService = {
    getSessionMessages: vi.fn(),
  };

  const mockRegistryService = {
    getProposal: vi.fn(),
  };

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
    mockRegistryService.getProposal.mockResolvedValue(mockRegistryEntry);

    const mockSession: LlmSession = {
      id: URN.parse('urn:llm:session:123'),
      title: 'Test',
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      attachments: [],
    };

    const assembly = await service.buildStreamRequest(mockSession);

    expect(mockRegistryService.getProposal).toHaveBeenCalledWith(
      pointer.proposalId,
    );
    expect(assembly.request.history[1].content).toContain(
      '[System Note: You proposed a modification for src/main.ts. The user has marked this proposal as: ACCEPTED.]',
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
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      attachments: [],
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
    expect(firstMessageContent).toContain('export const X = 1;');
    expect(firstMessageContent).toContain('Hello');
  });

  it('should bundle the stream request with correct cache IDs and inline attachments', async () => {
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
      llmModel: 'gemini-1.5-pro',
      compiledCache: {
        id: URN.parse('urn:gemini:compiled-cache:abc'),
        provider: 'gemini',
        expiresAt: 'now' as ISODateTimeString,
        createdAt: 'now' as ISODateTimeString,
        sources: [],
      },
      attachments: [
        {
          id: URN.parse('urn:llm:attachment:1'),
          target: 'inline-context',
          // SCHEMA UPDATE: cacheId -> dataSourceId
          dataSourceId: URN.parse('urn:data-source:repo:2'),
        },
      ],
    };

    const assembly = await service.buildStreamRequest(mockSession);

    expect(assembly.request.model).toBe('gemini-1.5-pro');
    expect(assembly.request.compiledCacheId).toBeInstanceOf(URN);
    expect(assembly.request.inlineAttachments?.length).toBe(1);
    expect(
      assembly.request.inlineAttachments?.[0].dataSourceId.toString(),
    ).toBe('urn:data-source:repo:2');
  });
});
