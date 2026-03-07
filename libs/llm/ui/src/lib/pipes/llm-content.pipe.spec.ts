import { LlmContentPipe } from './llm-content.pipe';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SSEProposalEvent,
  PointerPayload,
  FileLinkType,
  FileProposalType,
  TextType,
} from '@nx-platform-application/llm-types';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

describe('LlmContentPipe', () => {
  let pipe: LlmContentPipe;
  let encoder: TextEncoder;

  beforeEach(() => {
    pipe = new LlmContentPipe();
    encoder = new TextEncoder();
  });

  it('should return empty text for null/invalid input', () => {
    expect(pipe.transform(undefined)).toEqual({ type: 'text', content: '' });
  });

  it('should decode standard text payloads', () => {
    const rawText = 'Here is the markdown response.';
    const input = {
      typeId: TextType,
      payloadBytes: encoder.encode(rawText),
    } as any;

    const result = pipe.transform(input);

    expect(result.type).toBe('text');
    expect((result as any).content).toBe(rawText);
  });

  it('should decode and parse workspace_proposal payloads (Legacy)', () => {
    const mockProposal: SSEProposalEvent = {
      originalContent: 'old',
      proposal: {
        id: 'prop-1',
        sessionId: 'sess-1',
        filePath: 'main.ts',
        reasoning: 'Fixed bug',
        status: 'pending',
        createdAt: 'now' as ISODateTimeString,
      },
    };

    const storagePayload = JSON.stringify({
      __type: 'workspace_proposal',
      data: mockProposal,
    });

    const input = {
      typeId: FileProposalType,
      payloadBytes: encoder.encode(storagePayload),
    } as any;
    const result = pipe.transform(input);

    expect(result.type).toBe('proposal');
    expect((result as any).event.originalContent).toBe('old');
  });

  it('should decode and parse pointer payloads (New Architecture)', () => {
    const mockPointer: PointerPayload = {
      proposalId: URN.parse('urn:llm:proposal:123'),
      filePath: 'src/main.ts',
      snippet: '+ new line',
    };

    const input = {
      typeId: FileLinkType,
      payloadBytes: encoder.encode(JSON.stringify(mockPointer)),
    } as any;
    const result = pipe.transform(input);

    expect(result.type).toBe('pointer');
    expect((result as any).pointer.filePath).toBe('src/main.ts');
  });
});
