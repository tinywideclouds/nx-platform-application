import { TestBed } from '@angular/core/testing';
import { MarkdownParser } from './markdown.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('MarkdownParser', () => {
  let parser: MarkdownParser;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MarkdownParser] });
    parser = TestBed.inject(MarkdownParser);
  });

  it('should parse a markdown string into tokens', () => {
    const md = '# Hello\n\nThis is **bold**.';
    const tokens = parser.parse(md);

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].type).toBe('heading');
  });
});
