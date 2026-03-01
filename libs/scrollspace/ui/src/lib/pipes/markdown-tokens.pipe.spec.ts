import { TestBed } from '@angular/core/testing';
import { MarkdownTokensPipe } from './markdown-tokens.pipe';
import { MarkdownParser } from '@nx-platform-application/scrollspace-core';
import { Token } from 'marked';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MarkdownTokensPipe', () => {
  let pipe: MarkdownTokensPipe;
  let mockParser: any;

  beforeEach(() => {
    mockParser = {
      parse: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        MarkdownTokensPipe,
        { provide: MarkdownParser, useValue: mockParser },
      ],
    });
    pipe = TestBed.inject(MarkdownTokensPipe);
  });

  it('should parse text into tokens', () => {
    const mockTokens = [{ type: 'paragraph', raw: 'hello' } as Token];
    mockParser.parse.mockReturnValue(mockTokens);

    const result = pipe.transform('hello');
    expect(result).toEqual(mockTokens);
    expect(mockParser.parse).toHaveBeenCalledWith('hello');
  });

  it('should reuse old token object references to stabilize the DOM during streaming', () => {
    // 1st Tick: Stream emits "hello"
    const oldTokens = [{ type: 'paragraph', raw: 'hello' } as Token];
    mockParser.parse.mockReturnValue([...oldTokens]);
    const firstResult = pipe.transform('hello');

    // 2nd Tick: Stream emits "hello world"
    const newTokens = [
      { type: 'paragraph', raw: 'hello' } as Token, // Identical raw content
      { type: 'paragraph', raw: ' world' } as Token, // New content
    ];
    mockParser.parse.mockReturnValue([...newTokens]);
    const secondResult = pipe.transform('hello world');

    // VERIFY STABILIZATION: The first token in the new array should be the EXACT same object reference in memory as before
    expect(secondResult[0]).toBe(firstResult[0]);
    // The second token is new
    expect(secondResult[1].raw).toBe(' world');
  });
});
