import { TestBed } from '@angular/core/testing';
import { URN } from '@nx-platform-application/platform-types';
import { GroupParserStrategy } from './group.strategies';
import {
  MESSAGE_TYPE_GROUP_INVITE,
  GroupInvitePayload,
} from '../models/group-protocol-types';

describe('GroupParserStrategy', () => {
  let strategy: GroupParserStrategy;
  const encoder = new TextEncoder();
  const mockContext = { tags: [] };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [GroupParserStrategy] });
    strategy = TestBed.inject(GroupParserStrategy);
  });

  it('should support group invite types', () => {
    expect(strategy.supports(URN.parse(MESSAGE_TYPE_GROUP_INVITE))).toBe(true);
  });

  it('should parse group invite payload', () => {
    const invite: GroupInvitePayload = {
      groupUrn: 'urn:group:1',
      name: 'Test Group',
      inviterUrn: 'urn:user:1',
    };
    const bytes = encoder.encode(JSON.stringify(invite));

    const result = strategy.parse(
      URN.parse(MESSAGE_TYPE_GROUP_INVITE),
      bytes,
      mockContext,
    );

    expect(result.kind).toBe('content');
    if (result.kind === 'content') {
      expect(result.payload.kind).toBe('group-invite');
      expect((result.payload as any).data.name).toBe('Test Group');
    }
  });
});
