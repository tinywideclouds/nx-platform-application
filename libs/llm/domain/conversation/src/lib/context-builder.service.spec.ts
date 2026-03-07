import { TestBed } from '@angular/core/testing';
import { LlmContextBuilderService } from './context-builder.service';
import {
  LlmStorageService,
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

  const mockStorageService = {
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
        { provide: LlmStorageService, useValue: mockStorageService },
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

    // Setup Pointer Message
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
    mockStorageService.getSessionMessages.mockResolvedValue(mockMessages);

    // Setup Registry Mock
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

    // Verify the builder successfully looked up the registry and injected the correct system note
    expect(mockRegistryService.getProposal).toHaveBeenCalledWith(
      pointer.proposalId,
    );
    expect(assembly.request.history[1].content).toContain(
      '[System Note: You proposed a modification for src/main.ts. The user has marked this proposal as: ACCEPTED.]',
    );
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
    mockStorageService.getSessionMessages.mockResolvedValue(mockMessages);

    const mockSession: LlmSession = {
      id: URN.parse('urn:llm:session:123'),
      title: 'Test',
      lastModified: '2026-02-27T10:00:00Z' as ISODateTimeString,
      llmModel: 'gemini-1.5-pro',
      geminiCache: 'cachedContents/abc',
      attachments: [
        {
          id: 'att-1',
          target: 'gemini-cache',
          cacheId: URN.parse('urn:llm:repo:1'),
        },
        {
          id: 'att-2',
          target: 'inline-context',
          cacheId: URN.parse('urn:llm:repo:2'),
        },
      ],
    };

    const assembly = await service.buildStreamRequest(mockSession);

    expect(assembly.request.model).toBe('gemini-1.5-pro');
    expect(assembly.request.cacheId).toBe('cachedContents/abc');
    expect(assembly.request.inlineAttachments?.length).toBe(1);
    expect(assembly.request.inlineAttachments?.[0].cacheId).toBe(
      'urn:llm:repo:2',
    );
  });
});
