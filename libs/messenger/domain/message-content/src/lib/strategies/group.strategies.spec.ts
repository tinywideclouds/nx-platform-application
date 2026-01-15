import { TestBed } from '@angular/core/testing';
import { GroupParserStrategy } from './group.strategies';
import {
  MessageGroupInvite, // ✅ Use the URN object
  GroupInvitePayload,
} from '../models/group-protocol-types';

describe('GroupParserStrategy', () => {
  let strategy: GroupParserStrategy;
  const encoder = new TextEncoder();
  const mockContext = { tags: [] } as any; // Cast for simplified context

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [GroupParserStrategy] });
    strategy = TestBed.inject(GroupParserStrategy);
  });

  it('should support group invite types', () => {
    // ✅ FIX: Pass URN object directly, don't parse undefined string
    expect(strategy.supports(MessageGroupInvite)).toBe(true);
  });

  it('should parse group invite payload', () => {
    const invite: GroupInvitePayload = {
      groupUrn: 'urn:group:1',
      name: 'Test Group',
      inviterUrn: 'urn:user:1',
    };
    const bytes = encoder.encode(JSON.stringify(invite));

    // ✅ FIX: Pass URN object directly
    const result = strategy.parse(MessageGroupInvite, bytes, mockContext);

    expect(result.kind).toBe('content');
    if (result.kind === 'content') {
      expect(result.payload.kind).toBe('group-invite');
      expect((result.payload as any).data.name).toBe('Test Group');
    }
  });
});
