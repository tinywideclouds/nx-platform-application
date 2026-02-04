import { TestBed } from '@angular/core/testing';
import { NetworkGroupStrategy } from './group-network.strategy';
import { DirectoryQueryApi } from '@nx-platform-application/directory-api';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SendContext } from '../send-strategy.interface';

describe('NetworkGroupStrategy', () => {
  let strategy: NetworkGroupStrategy;
  let directoryApi: DirectoryQueryApi;

  const groupUrn = URN.parse('urn:messenger:group:project-x');
  const member1 = URN.parse('urn:identity:google:1');
  const member2 = URN.parse('urn:identity:google:2');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NetworkGroupStrategy,
        MockProvider(Logger),
        MockProvider(DirectoryQueryApi, {
          getGroup: vi.fn(),
        }),
      ],
    });

    strategy = TestBed.inject(NetworkGroupStrategy);
    directoryApi = TestBed.inject(DirectoryQueryApi);
  });

  it('should return all group members for standard messages', async () => {
    vi.mocked(directoryApi.getGroup).mockResolvedValue({
      members: [{ id: member1 }, { id: member2 }],
    } as any);

    const ctx = {
      recipientUrn: groupUrn,
      isEphemeral: false, // Standard message
    } as SendContext;

    const targets = await strategy.getTargets(ctx);

    expect(targets).toHaveLength(1);
    expect(targets[0].recipients).toHaveLength(2);
    expect(targets[0].recipients).toContainEqual(member1);
    expect(targets[0].recipients).toContainEqual(member2);
  });

  it('should SUPPRESS ephemeral messages if group is too large', async () => {
    // Create 6 members (Limit is 5)
    const bigGroup = Array.from({ length: 6 }, (_, i) => ({
      id: URN.create('identity', 'google', `${i}`),
    }));

    vi.mocked(directoryApi.getGroup).mockResolvedValue({
      members: bigGroup,
    } as any);

    const ctx = {
      recipientUrn: groupUrn,
      isEphemeral: true, // Typing Indicator
    } as SendContext;

    const targets = await strategy.getTargets(ctx);

    // ✅ VERIFY: Should block the send to save bandwidth
    expect(targets).toHaveLength(0);
  });

  it('should ALLOW ephemeral messages if group is small', async () => {
    const smallGroup = Array.from({ length: 5 }, (_, i) => ({
      id: URN.create('identity', 'google', `${i}`),
    }));

    vi.mocked(directoryApi.getGroup).mockResolvedValue({
      members: smallGroup,
    } as any);

    const ctx = { recipientUrn: groupUrn, isEphemeral: true } as SendContext;
    const targets = await strategy.getTargets(ctx);

    expect(targets).toHaveLength(1);
  });
});
