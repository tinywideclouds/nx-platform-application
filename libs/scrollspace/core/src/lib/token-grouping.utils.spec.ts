import { TokenGrouper } from './token-grouping.utils';
import { describe, it, expect } from 'vitest';

describe('TokenGrouper', () => {
  it('should group standard tokens as content', () => {
    const tokens: any[] = [
      { type: 'paragraph', raw: 'Hello' },
      { type: 'space', raw: '\n' },
    ];

    const result = TokenGrouper.group(tokens);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('content');
    expect(result[0].tokens).toHaveLength(2);
  });

  it('should isolate <think> HTML blocks into their own thought group', () => {
    const tokens: any[] = [
      { type: 'paragraph', raw: 'Let me think.' },
      { type: 'html', raw: '<think>\nThinking process...\n</think>' },
      { type: 'paragraph', raw: 'Here is the answer.' },
    ];

    const result = TokenGrouper.group(tokens);

    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('content');
    expect(result[1].type).toBe('thought');
    expect(result[1].tokens[0].raw).toContain('<think>');
    expect(result[2].type).toBe('content');
  });
});
