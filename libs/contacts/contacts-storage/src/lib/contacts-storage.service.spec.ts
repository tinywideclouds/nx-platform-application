import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContactsStorageService } from './contacts-storage.service';
import { ContactsDatabase } from './db/contacts.database';
import {
  StorableContact,
  StorableGroup,
  StorableServiceContact,
  StorableBlockedIdentity, // New
} from './models/contacts';

import {
  Contact,
  ContactGroup,
  ServiceContact,
} from '@nx-platform-application/contacts-types';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

// --- Mocks ---
const {
  mockDbTable,
  mockDbGroupTable,
  mockDbLinksTable,
  mockDbPendingTable,
  mockDbBlockedTable, // ✅ NEW
  mockDbTombstonesTable,
  mockContactsDb,
} = vi.hoisted(() => {
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
  };

  // ✅ NEW: Blocked Table Mock
  const blockedTableMock = {
    put: vi.fn(),
    where: vi.fn(() => blockedTableMock),
    equals: vi.fn(() => blockedTableMock),
    first: vi.fn(),
    toArray: vi.fn(),
    bulkDelete: vi.fn(),
    clear: vi.fn(),
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
    mockDbBlockedTable: blockedTableMock, // ✅ NEW
    mockDbTombstonesTable: tombstonesTableMock,
    mockContactsDb: {
      contacts: tableMock,
      groups: groupTableMock,
      links: linksTableMock,
      pending: pendingTableMock,
      blocked: blockedTableMock, // ✅ NEW
      tombstones: tombstonesTableMock,
      transaction: vi.fn(async (_mode, _tables, callback) => await callback()),
    },
  };
});

// --- Fixtures ---
const mockContactUrn = URN.parse('urn:contacts:user:user-123');
const mockGroupUrn = URN.parse('urn:contacts:group:grp-abc');
const mockStrangerUrn = URN.parse('urn:auth:apple:stranger');
const mockGoogleAuthUrn = URN.parse('urn:auth:google:bob-123');
const mockServiceContactUrn = URN.parse('urn:message:service:msg-uuid-1');

// Block Fixtures
const mockBlockedUrn = URN.parse('urn:lookup:email:pest@test.com');
const mockStorableBlocked: StorableBlockedIdentity = {
  id: 1,
  urn: mockBlockedUrn.toString(),
  blockedAt: '2023-01-01T00:00:00Z' as ISODateTimeString,
  scopes: ['all'],
  reason: 'spam',
};

const mockServiceContact: ServiceContact = {
  id: mockServiceContactUrn,
  alias: 'jd_messenger',
  lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
};

const mockContact: Contact = {
  id: mockContactUrn,
  alias: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  surname: 'Doe',
  phoneNumbers: ['+15550199'],
  emailAddresses: ['john@example.com', 'work@example.com'],
  serviceContacts: {
    messenger: mockServiceContact,
  },
  lastModified: '2020-01-01T00:00:00Z' as ISODateTimeString,
};

const mockGroup: ContactGroup = {
  id: mockGroupUrn,
  name: 'Family',
  contactIds: [mockContactUrn],
};

// --- STORABLE FIXTURES ---
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

const mockStorableGroup: StorableGroup = {
  id: mockGroupUrn.toString(),
  name: 'Family',
  contactIds: [mockContactUrn.toString()],
};

describe('ContactsStorageService', () => {
  let service: ContactsStorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ContactsStorageService,
        { provide: ContactsDatabase, useValue: mockContactsDb },
      ],
    });

    service = TestBed.inject(ContactsStorageService);

    // Setup Default Returns
    mockDbTable.get.mockResolvedValue(mockStorableContact);
    mockDbTable.toArray.mockResolvedValue([mockStorableContact]);
    mockDbBlockedTable.toArray.mockResolvedValue([]);
    mockDbBlockedTable.first.mockResolvedValue(undefined);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ... (Existing CRUD, Search, Group tests omitted for brevity) ...

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
      // Return existing
      mockDbBlockedTable.first.mockResolvedValue(mockStorableBlocked);

      await service.blockIdentity(mockBlockedUrn, ['messenger']);

      expect(mockDbBlockedTable.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1, // Should preserve ID
          scopes: ['messenger'],
          // Should preserve previous reason if not provided
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
      // Simulate finding 2 records (defensive)
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
