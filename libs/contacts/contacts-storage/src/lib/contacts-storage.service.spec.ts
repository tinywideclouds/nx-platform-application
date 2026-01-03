import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContactsStorageService } from './contacts-storage.service';
import { ContactsDatabase } from './db/contacts.database';
import {
  StorableContact,
  StorableServiceContact,
  StorableBlockedIdentity,
} from './records/contact.record';
import { StorableGroup } from './records/group.record';

import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

// ✅ NEW: Import Real Mappers (No mocks needed for pure logic)
import { ContactMapper } from './mappers/contact.mapper';
import { GroupMapper } from './mappers/group.mapper';

// --- Mocks ---
const {
  mockDbTable,
  mockDbGroupTable,
  mockDbLinksTable,
  mockDbPendingTable,
  mockDbBlockedTable,
  mockDbTombstonesTable,
  mockContactsDb,
} = vi.hoisted(() => {
  // ... (Same mock setup as before, omitted for brevity) ...
  const tableMock = {
    put: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    bulkPut: vi.fn(),
    bulkGet: vi.fn(),
    orderBy: vi.fn(() => tableMock),
    where: vi.fn(() => tableMock),
    equals: vi.fn(() => tableMock),
    toArray: vi.fn(),
    first: vi.fn(),
    clear: vi.fn(),
    filter: vi.fn(() => tableMock),
  };

  const groupTableMock = {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    orderBy: vi.fn(() => groupTableMock),
    where: vi.fn(() => groupTableMock),
    equals: vi.fn(() => groupTableMock),
    toArray: vi.fn(),
    clear: vi.fn(),
  };

  const linksTableMock = {
    put: vi.fn(),
    where: vi.fn(() => linksTableMock),
    equals: vi.fn(() => linksTableMock),
    toArray: vi.fn(),
    first: vi.fn(),
    clear: vi.fn(),
  };

  const pendingTableMock = {
    put: vi.fn(),
    where: vi.fn(() => pendingTableMock),
    equals: vi.fn(() => pendingTableMock),
    first: vi.fn(),
    toArray: vi.fn(),
    bulkDelete: vi.fn(),
    clear: vi.fn(),
    orderBy: vi.fn(() => pendingTableMock),
  };

  const blockedTableMock = {
    put: vi.fn(),
    where: vi.fn(() => blockedTableMock),
    equals: vi.fn(() => blockedTableMock),
    first: vi.fn(),
    toArray: vi.fn(),
    bulkDelete: vi.fn(),
    clear: vi.fn(),
    orderBy: vi.fn(() => blockedTableMock),
  };

  const tombstonesTableMock = {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    toArray: vi.fn(),
    clear: vi.fn(),
  };

  return {
    mockDbTable: tableMock,
    mockDbGroupTable: groupTableMock,
    mockDbLinksTable: linksTableMock,
    mockDbPendingTable: pendingTableMock,
    mockDbBlockedTable: blockedTableMock,
    mockDbTombstonesTable: tombstonesTableMock,
    mockContactsDb: {
      contacts: tableMock,
      groups: groupTableMock,
      links: linksTableMock,
      pending: pendingTableMock,
      blocked: blockedTableMock,
      tombstones: tombstonesTableMock,
      transaction: vi.fn(async (_mode, _tables, callback) => await callback()),
    },
  };
});

// --- Fixtures ---
const mockContactUrn = URN.parse('urn:contacts:user:user-123');
const mockGroupUrn = URN.parse('urn:contacts:group:grp-abc');
const mockBlockedUrn = URN.parse('urn:lookup:email:pest@test.com');
const mockServiceContactUrn = URN.parse('urn:message:service:msg-uuid-1');

const mockStorableBlocked: StorableBlockedIdentity = {
  id: 1,
  urn: mockBlockedUrn.toString(),
  blockedAt: '2023-01-01T00:00:00Z' as ISODateTimeString,
  scopes: ['all'],
  reason: 'spam',
};

const mockStorableServiceContact: StorableServiceContact = {
  id: mockServiceContactUrn.toString(),
  alias: 'jd_messenger',
  lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
};

const mockStorableContact: StorableContact = {
  id: mockContactUrn.toString(),
  alias: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  surname: 'Doe',
  phoneNumbers: ['+15550199'],
  emailAddresses: ['john@example.com', 'work@example.com'],
  serviceContacts: {
    messenger: mockStorableServiceContact,
  },
  lastModified: '2020-01-01T00:00:00Z' as ISODateTimeString,
};

// ✅ UPDATED: Mock Group with new fields
const mockStorableGroup: StorableGroup = {
  id: mockGroupUrn.toString(),
  name: 'Family',
  description: 'My Group',
  scope: 'local',
  contactIds: [mockContactUrn.toString()],
  members: [
    {
      contactId: mockContactUrn.toString(),
      role: 'member',
      status: 'joined',
    },
  ],
  lastModified: '2023-01-01T00:00:00Z' as ISODateTimeString,
};

describe('ContactsStorageService', () => {
  let service: ContactsStorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ContactsStorageService,
        { provide: ContactsDatabase, useValue: mockContactsDb },
        // ✅ Provide Real Mappers
        ContactMapper,
        GroupMapper,
      ],
    });

    service = TestBed.inject(ContactsStorageService);

    // Setup Default Returns
    mockDbTable.get.mockResolvedValue(mockStorableContact);
    mockDbTable.toArray.mockResolvedValue([mockStorableContact]);

    // Group Returns
    mockDbGroupTable.get.mockResolvedValue(mockStorableGroup);
    mockDbGroupTable.toArray.mockResolvedValue([mockStorableGroup]);

    mockDbBlockedTable.toArray.mockResolvedValue([]);
    mockDbBlockedTable.first.mockResolvedValue(undefined);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Groups (Polymorphic)', () => {
    it('should retrieve groups by scope', async () => {
      await service.getGroupsByScope('local');
      expect(mockDbGroupTable.where).toHaveBeenCalledWith('scope');
      expect(mockDbGroupTable.equals).toHaveBeenCalledWith('local');
    });

    it('should map storable group to domain group correctly', async () => {
      const groups = await service.getGroupsForContact(mockContactUrn);
      const group = groups[0];

      expect(group.id.toString()).toBe(mockGroupUrn.toString());
      expect((group as any).scope).toBe('local');
      expect(group.members.length).toBe(1);
      expect(group.members[0].contactId.toString()).toBe(
        mockContactUrn.toString(),
      );
    });
  });

  describe('Gatekeeper: Blocking', () => {
    it('should add identity to block list', async () => {
      await service.blockIdentity(mockBlockedUrn, ['all'], 'spam');

      expect(mockDbBlockedTable.put).toHaveBeenCalledWith(
        expect.objectContaining({
          urn: mockBlockedUrn.toString(),
          scopes: ['all'],
          reason: 'spam',
          blockedAt: expect.any(String),
        }),
      );
    });

    it('should update existing blocked entry if present', async () => {
      mockDbBlockedTable.first.mockResolvedValue(mockStorableBlocked);

      await service.blockIdentity(mockBlockedUrn, ['messenger']);

      expect(mockDbBlockedTable.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          scopes: ['messenger'],
          reason: 'spam',
        }),
      );
    });

    it('should retrieve all blocked identities', async () => {
      mockDbBlockedTable.toArray.mockResolvedValue([mockStorableBlocked]);

      const result = await service.getAllBlockedIdentities();

      expect(result.length).toBe(1);
      expect(result[0].urn.toString()).toBe(mockBlockedUrn.toString());
      expect(result[0].scopes).toEqual(['all']);
    });

    it('should unblock identity (delete from DB)', async () => {
      mockDbBlockedTable.toArray.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ] as any);

      await service.unblockIdentity(mockBlockedUrn);

      expect(mockDbBlockedTable.where).toHaveBeenCalledWith('urn');
      expect(mockDbBlockedTable.equals).toHaveBeenCalledWith(
        mockBlockedUrn.toString(),
      );
      expect(mockDbBlockedTable.bulkDelete).toHaveBeenCalledWith([1, 2]);
    });
  });
});
