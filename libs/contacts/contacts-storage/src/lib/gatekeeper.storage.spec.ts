import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GatekeeperStorage } from './gatekeeper.storage';
import { URN } from '@nx-platform-application/platform-types';

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
    delete: vi.fn(),
  };
  return {
    mockDb: {
      blocked: table,
      pending: table,
      // FIX: Mock transaction to immediately execute the callback
      transaction: vi.fn(async (mode, tables, callback) => await callback()),
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

  describe('blockIdentity', () => {
    it('should atomically add to blocked list using a transaction', async () => {
      const urn = URN.parse('urn:contacts:user:spammer');
      await service.blockIdentity(urn, ['all'], 'spam');

      // 1. Verify Transaction Usage
      expect(mockDb.transaction).toHaveBeenCalledWith(
        'rw',
        mockDb.blocked,
        expect.any(Function),
      );

      // 2. Verify Put Operation
      expect(mockDb.blocked.put).toHaveBeenCalledWith(
        expect.objectContaining({
          urn: urn.toString(),
          reason: 'spam',
        }),
      );
    });
  });

  describe('addToPending', () => {
    it('should atomically add to pending list using a transaction', async () => {
      const urn = URN.parse('urn:contacts:user:stranger');

      // Mock existing record to verify merge logic inside transaction
      mockDb.pending.first.mockResolvedValue({
        id: 1,
        urn: urn.toString(),
        firstSeenAt: 'old_date',
        note: 'old_note',
      });

      await service.addToPending(urn, undefined, 'new_note');

      // 1. Verify Transaction Usage
      expect(mockDb.transaction).toHaveBeenCalledWith(
        'rw',
        mockDb.pending,
        expect.any(Function),
      );

      // 2. Verify Merge Logic (Keep ID/Date, Update Note)
      expect(mockDb.pending.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          urn: urn.toString(),
          firstSeenAt: 'old_date',
          note: 'new_note',
        }),
      );
    });
  });

  describe('unblockIdentity', () => {
    it('should remove identity from blocked list', async () => {
      const urn = URN.parse('urn:contacts:user:forgiven');

      // Mock finding the record to delete
      mockDb.blocked.toArray.mockResolvedValue([{ id: 123 }]);

      await service.unblockIdentity(urn);

      expect(mockDb.blocked.bulkDelete).toHaveBeenCalledWith([123]);
    });
  });
});
