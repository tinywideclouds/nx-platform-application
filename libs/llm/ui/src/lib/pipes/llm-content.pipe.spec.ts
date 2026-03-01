import { LlmContentPipe } from './llm-content.pipe';
import { describe, it, expect, beforeEach } from 'vitest';
import { SSEProposalEvent } from '@nx-platform-application/llm-types';

describe('LlmContentPipe', () => {
  let pipe: LlmContentPipe;
  let encoder: TextEncoder;

  beforeEach(() => {
    pipe = new LlmContentPipe();
    encoder = new TextEncoder();
  });

  it('should return empty text for null/invalid input', () => {
    expect(pipe.transform(null)).toEqual({ type: 'text', content: '' });
    expect(pipe.transform({})).toEqual({ type: 'text', content: '' });
  });

  it('should decode standard text payloads', () => {
    const rawText = 'Here is the markdown response.';
    const input = { payloadBytes: encoder.encode(rawText) };

    const result = pipe.transform(input);

    expect(result.type).toBe('text');
    expect((result as any).content).toBe(rawText);
  });

  it('should decode and parse workspace_proposal payloads', () => {
    const mockProposal: SSEProposalEvent = {
      originalContent: 'old',
      proposal: {
        id: 'prop-1',
        sessionId: 'sess-1',
        filePath: 'main.ts',
        reasoning: 'Fixed bug',
        status: 'pending',
        createdAt: 'now',
      },
    };

    const storagePayload = JSON.stringify({
      __type: 'workspace_proposal',
      data: mockProposal,
    });

    const input = { payloadBytes: encoder.encode(storagePayload) };
    const result = pipe.transform(input);

    expect(result.type).toBe('proposal');
    expect((result as any).event.originalContent).toBe('old');
    expect((result as any).event.proposal.filePath).toBe('main.ts');
  });

  it('should gracefully fallback to text if the proposal JSON is corrupted', () => {
    const corruptedJson = '{"__type":"workspace_proposal", "data": BROKEN_JSON';
    const input = { payloadBytes: encoder.encode(corruptedJson) };

    const result = pipe.transform(input);

    expect(result.type).toBe('text');
    expect((result as any).content).toBe(corruptedJson);
  });
});
