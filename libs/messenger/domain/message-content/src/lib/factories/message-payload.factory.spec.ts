// libs/messenger/domain/message-content/src/lib/factories/message-payload.factory.spec.ts

import { describe, it, expect } from 'vitest';
import { MessagePayloadFactory } from './message-payload.factory';
import { URN } from '@nx-platform-application/platform-types';

describe('MessagePayloadFactory', () => {
  const groupUrn = URN.parse('urn:messenger:group:test-1');
  const inviterUrn = URN.parse('urn:identity:google:me');

  it('should create valid Group Invite structure', () => {
    const result = MessagePayloadFactory.createGroupInvite(
      groupUrn,
      inviterUrn,
      'My Group',
      [{ urn: 'urn:user:1', alias: 'Bob' }],
    );

    expect(result.kind).toBe('group-invite');
    expect(result.data.groupUrn).toBe(groupUrn.toString());
    expect(result.data.name).toBe('My Group');
    expect(result.data.participants[0].alias).toBe('Bob');
  });

  it('should create valid Joined Signal', () => {
    const result = MessagePayloadFactory.createJoinedSignal(groupUrn);

    expect(result.kind).toBe('group-system');
    expect(result.data.status).toBe('joined');
    expect(result.data.groupUrn).toBe(groupUrn.toString());
    expect(result.data.timestamp).toBeDefined();
  });
});
