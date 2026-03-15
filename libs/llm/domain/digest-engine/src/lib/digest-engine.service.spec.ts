import { TestBed } from '@angular/core/testing';
import { LlmDigestEngineService } from './digest-engine.service';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { DigestStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmDigestSource } from '@nx-platform-application/llm-features-memory';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import {
  FileProposalType,
  LlmMessage,
  TextType,
} from '@nx-platform-application/llm-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Prompts } from './prompt';

describe('LlmDigestEngineService', () => {
  let service: LlmDigestEngineService;
  let mockNetwork: any;
  let mockStorage: any;
  let mockDigestSource: any;

  const sessionId = URN.parse('urn:llm:session:123');
  const encoder = new TextEncoder();

  // Helper to quickly build strictly typed mock messages
  const createMockMsg = (
    id: string,
    role: 'user' | 'model',
    typeId: URN,
    content: string,
  ): LlmMessage =>
    ({
      id: URN.parse(id),
      role,
      typeId,
      timestamp: '2026-03-15T12:00:00Z',
      payloadBytes: encoder.encode(content),
    }) as LlmMessage;

  beforeEach(() => {
    mockNetwork = {
      generate: vi.fn().mockResolvedValue({
        content: 'Mocked Digest Content',
        promptTokenCount: 100,
      }),
    };

    mockStorage = {
      saveDigest: vi.fn().mockResolvedValue(undefined),
    };

    mockDigestSource = {
      refresh: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        LlmDigestEngineService,
        { provide: LLM_NETWORK_CLIENT, useValue: mockNetwork },
        { provide: DigestStorageService, useValue: mockStorage },
        { provide: LlmDigestSource, useValue: mockDigestSource },
        { provide: Logger, useValue: { debug: vi.fn(), error: vi.fn() } },
      ],
    });

    service = TestBed.inject(LlmDigestEngineService);
  });

  it('should process a standard text chunk correctly', async () => {
    const msgs = [
      createMockMsg('urn:llm:message:1', 'user', TextType, 'Hello'),
      createMockMsg('urn:llm:message:2', 'model', TextType, 'Hi there'),
    ];

    await service.processChunk(sessionId, 'gemini-flash', msgs);

    const generateCallArgs = mockNetwork.generate.mock.calls[0][0];
    expect(generateCallArgs.systemPrompt).toBe(Prompts.Standard);
    expect(generateCallArgs.prompt).toContain('[User]: Hello');
    expect(generateCallArgs.prompt).toContain('[Assistant]: Hi there');

    // Ensure the saved digest accurately mapped the message boundaries
    const savedDigest = mockStorage.saveDigest.mock.calls[0][0];
    expect(savedDigest.coveredMessageIds).toHaveLength(2);
    expect(savedDigest.registryEntities).toHaveLength(0);
  });

  it('should replace raw JSON with semantic markers when includeRawProposals is false', async () => {
    const rawJson = JSON.stringify({
      proposalId: 'urn:llm:proposal:abc',
      proposal: { filePath: 'src/app.ts' },
    });
    const msgs = [
      createMockMsg('urn:llm:message:3', 'model', FileProposalType, rawJson),
    ];

    // Options omitted, includeRawProposals defaults to false
    await service.processChunk(sessionId, 'gemini-flash', msgs);

    const generateCallArgs = mockNetwork.generate.mock.calls[0][0];

    // The raw JSON should NOT be in the prompt sent to the LLM
    expect(generateCallArgs.prompt).not.toContain(rawJson);
    // The semantic marker SHOULD be there
    expect(generateCallArgs.prompt).toContain(
      '[System Semantic Marker: Assistant proposed a code change to "src/app.ts"]',
    );

    const savedDigest = mockStorage.saveDigest.mock.calls[0][0];
    // The URN should still be successfully extracted to the registry!
    expect(savedDigest.registryEntities[0].toString()).toBe(
      'urn:llm:proposal:abc',
    );
  });

  it('should include raw JSON when includeRawProposals is true', async () => {
    const rawJson = JSON.stringify({
      proposalId: 'urn:llm:proposal:xyz',
      proposal: { filePath: 'src/main.ts' },
    });
    const msgs = [
      createMockMsg('urn:llm:message:4', 'model', FileProposalType, rawJson),
    ];

    await service.processChunk(sessionId, 'gemini-flash', msgs, {
      includeRawProposals: true,
    });

    const generateCallArgs = mockNetwork.generate.mock.calls[0][0];

    // The raw JSON SHOULD be in the prompt sent to the LLM
    expect(generateCallArgs.prompt).toContain(rawJson);
    expect(generateCallArgs.prompt).not.toContain('System Semantic Marker');
  });

  it('should apply custom prompts if provided', async () => {
    const msgs = [createMockMsg('urn:llm:message:5', 'user', TextType, 'Test')];

    await service.processChunk(sessionId, 'gemini-flash', msgs, {
      customPrompt: Prompts.Debugging,
    });

    const generateCallArgs = mockNetwork.generate.mock.calls[0][0];
    expect(generateCallArgs.systemPrompt).toBe(Prompts.Debugging);
  });
});
