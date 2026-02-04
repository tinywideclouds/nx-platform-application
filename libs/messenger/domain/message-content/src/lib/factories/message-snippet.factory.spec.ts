import { TestBed } from '@angular/core/testing';
import { MessageSnippetFactory } from './message-snippet.factory';
import { URN } from '@nx-platform-application/platform-types';
import { ParsedMessage } from '../models/content-types';

describe('MessageSnippetFactory', () => {
  let factory: MessageSnippetFactory;
  const mockUrn = URN.parse('urn:messenger:group:1');

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MessageSnippetFactory] });
    factory = TestBed.inject(MessageSnippetFactory);
  });

  it('should truncate long text', () => {
    const longText = 'A'.repeat(100);
    const parsed: ParsedMessage = {
      kind: 'content',
      conversationId: mockUrn,
      tags: [],
      payload: { kind: 'text', text: longText },
    };

    const snippet = factory.createSnippet(parsed);
    expect(snippet.length).toBeLessThan(70);
    expect(snippet).toMatch(/\.\.\.$/);
  });

  it('should handle images', () => {
    const parsed: ParsedMessage = {
      kind: 'content',
      conversationId: mockUrn,
      tags: [],
      payload: { kind: 'image' } as any,
    };
    expect(factory.createSnippet(parsed)).toBe('📷 Photo');
  });

  it('should handle group invites', () => {
    const parsed: ParsedMessage = {
      kind: 'content',
      conversationId: mockUrn,
      tags: [],
      payload: {
        kind: 'group-invite',
        data: { name: 'Party Planning' },
      } as any,
    };
    expect(factory.createSnippet(parsed)).toBe('👥 Invite: Party Planning');
  });

  it('should handle system messages', () => {
    const parsed: ParsedMessage = {
      kind: 'content',
      conversationId: mockUrn,
      tags: [],
      payload: {
        kind: 'group-system',
        data: { status: 'joined' },
      } as any,
    };
    expect(factory.createSnippet(parsed)).toBe('You joined the group');
  });
});
