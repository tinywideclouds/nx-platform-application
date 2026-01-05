import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GatekeeperStorage } from './gatekeeper.storage';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

import {
  ContactsDatabase,
  ContactMapper,
} from '@nx-platform-application/contacts-persistence';

const { mockDb } = vi.hoisted(() => {
  const table = {
    put: vi.fn(),
    first: vi.fn(),
    toArray: vi.fn(),
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    bulkDelete: vi.fn(),
  };
  return {
    mockDb: {
      blocked: table,
      pending: table,
    },
  };
});

describe('GatekeeperStorage', () => {
  let service: GatekeeperStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        GatekeeperStorage,
        { provide: ContactsDatabase, useValue: mockDb },
        ContactMapper,
      ],
    });
    service = TestBed.inject(GatekeeperStorage);
  });

  it('should add to blocked list', async () => {
    const urn = URN.parse('urn:contacts:user:spammer');
    await service.blockIdentity(urn, ['all'], 'spam');

    expect(mockDb.blocked.put).toHaveBeenCalledWith(
      expect.objectContaining({
        urn: urn.toString(),
        reason: 'spam',
      }),
    );
  });

  it('should add to pending list', async () => {
    const urn = URN.parse('urn:contacts:user:stranger');
    await service.addToPending(urn);

    expect(mockDb.pending.put).toHaveBeenCalledWith(
      expect.objectContaining({
        urn: urn.toString(),
      }),
    );
  });
});
