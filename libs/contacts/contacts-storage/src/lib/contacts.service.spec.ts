import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContactsStorageService } from './contacts.service';
import { ContactsDatabase } from './db/contacts.database';
import {
  Contact,
  ContactGroup,
  StorableContact,
  StorableGroup,
  ServiceContact,
  StorableServiceContact,
  StorableIdentityLink,
  StorablePendingIdentity,
} from './models/contacts';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { firstValueFrom } from 'rxjs';

// --- Mocks ---
const {
  mockDbTable,
  mockDbGroupTable,
  mockDbLinksTable,
  mockDbPendingTable,
  mockDbTombstonesTable, // ✅ NEW
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

  const tombstonesTableMock = {
    // ✅ NEW
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
    mockDbTombstonesTable: tombstonesTableMock,
    mockContactsDb: {
      contacts: tableMock,
      // ✅ Renamed to match Service
      groups: groupTableMock,
      links: linksTableMock,
      pending: pendingTableMock,
      tombstones: tombstonesTableMock,
      // Blocked removed
      transaction: vi.fn(async (_mode, _tables, callback) => await callback()),
    },
  };
});

// --- Fixtures ---
const mockContactUrn = URN.parse('urn:contacts:user:user-123');
const mockGroupUrn = URN.parse('urn:contacts:group:grp-abc');
const mockOtherContactUrn = URN.parse('urn:contacts:user:user-456');
const mockServiceContactUrn = URN.parse('urn:message:service:msg-uuid-1');

const mockGoogleAuthUrn = URN.parse('urn:auth:google:bob-123');
const mockStrangerUrn = URN.parse('urn:auth:apple:stranger');
const mockVoucherUrn = URN.parse('urn:contacts:user:bob-contact');

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
  lastModified: '2020-01-01T00:00:00Z' as ISODateTimeString, // ✅ NEW
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
  lastModified: '2020-01-01T00:00:00Z' as ISODateTimeString, // ✅ NEW
};

const mockStorableGroup: StorableGroup = {
  id: mockGroupUrn.toString(),
  name: 'Family',
  contactIds: [mockContactUrn.toString()],
};

const mockStorableLink: StorableIdentityLink = {
  id: 1,
  contactId: mockContactUrn.toString(),
  authUrn: mockGoogleAuthUrn.toString(),
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
    mockDbTable.first.mockResolvedValue(mockStorableContact);
    mockDbTable.toArray.mockResolvedValue([mockStorableContact]);
    mockDbTable.bulkGet.mockResolvedValue([mockStorableContact]);

    mockDbGroupTable.get.mockResolvedValue(mockStorableGroup);
    mockDbGroupTable.toArray.mockResolvedValue([mockStorableGroup]);

    mockDbLinksTable.toArray.mockResolvedValue([]);
    mockDbLinksTable.first.mockResolvedValue(undefined);

    mockDbPendingTable.toArray.mockResolvedValue([]);
    mockDbPendingTable.first.mockResolvedValue(undefined);
    mockDbTombstonesTable.get.mockResolvedValue(undefined); // ✅ NEW
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('CRUD Operations', () => {
    it('should save a contact (mapping to storable)', async () => {
      await service.saveContact(mockContact);

      expect(mockDbTombstonesTable.delete).toHaveBeenCalledWith(
        mockStorableContact.id
      );

      expect(mockContactsDb.contacts.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockStorableContact.id,
          lastModified: expect.any(String), // Sync check
        })
      );
    });

    it('should get a contact by ID (mapping from storable)', async () => {
      const result = await service.getContact(mockContactUrn);
      expect(mockContactsDb.contacts.get).toHaveBeenCalledWith(
        mockContactUrn.toString()
      );
      expect(result).toEqual(mockContact);
    });

    it('should update a contact', async () => {
      const changes: Partial<Contact> = { alias: 'New Alias' };

      await service.updateContact(mockContactUrn, changes);

      expect(mockContactsDb.contacts.update).toHaveBeenCalledWith(
        mockContactUrn.toString(),
        expect.objectContaining({
          alias: 'New Alias',
          lastModified: expect.any(String),
        })
      );
    });

    it('should delete a contact (Smart Sync)', async () => {
      await service.deleteContact(mockContactUrn);

      expect(mockContactsDb.contacts.delete).toHaveBeenCalledWith(
        mockContactUrn.toString()
      );
      // ✅ Verify tombstone
      expect(mockDbTombstonesTable.put).toHaveBeenCalledWith(
        expect.objectContaining({
          urn: mockContactUrn.toString(),
          deletedAt: expect.any(String),
        })
      );
    });
  });

  describe('Search Operations', () => {
    it('should find by email', async () => {
      const searchEmail = 'work@example.com';
      const result = await service.findByEmail(searchEmail);

      expect(mockDbTable.where).toHaveBeenCalledWith('email');
      expect(mockDbTable.equals).toHaveBeenCalledWith(searchEmail);
      expect(result).toEqual(mockContact);
    });

    it('should find by phone', async () => {
      const searchPhone = '+15550199';
      const result = await service.findByPhone(searchPhone);

      expect(mockDbTable.where).toHaveBeenCalledWith('phoneNumbers');
      expect(mockDbTable.equals).toHaveBeenCalledWith(searchPhone);
      expect(result).toEqual(mockContact);
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk upsert', async () => {
      const batch = [mockContact];
      await service.bulkUpsert(batch);

      expect(mockContactsDb.transaction).toHaveBeenCalled();
      expect(mockContactsDb.contacts.bulkPut).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: mockStorableContact.id }),
        ])
      );
    });
  });

  describe('Group Operations', () => {
    it('should save a group', async () => {
      await service.saveGroup(mockGroup);
      expect(mockContactsDb.groups.put).toHaveBeenCalledWith(mockStorableGroup);
    });

    it('should get a group by ID', async () => {
      const result = await service.getGroup(mockGroupUrn);
      expect(mockContactsDb.groups.get).toHaveBeenCalledWith(
        mockGroupUrn.toString()
      );
      expect(result).toEqual(mockGroup);
    });

    it('should delete a group', async () => {
      await service.deleteGroup(mockGroupUrn);
      expect(mockContactsDb.groups.delete).toHaveBeenCalledWith(
        mockGroupUrn.toString()
      );
    });

    it('should get groups for a specific contact', async () => {
      const result = await service.getGroupsForContact(mockContactUrn);

      expect(mockDbGroupTable.where).toHaveBeenCalledWith('contactIds');
      expect(mockDbGroupTable.equals).toHaveBeenCalledWith(
        mockContactUrn.toString()
      );
      expect(result).toEqual([mockGroup]);
    });

    it('should get contacts for a specific group', async () => {
      const result = await service.getContactsForGroup(mockGroupUrn);

      expect(mockDbGroupTable.get).toHaveBeenCalledWith(
        mockGroupUrn.toString()
      );
      expect(mockDbTable.bulkGet).toHaveBeenCalledWith(
        mockStorableGroup.contactIds
      );
      expect(result).toEqual([mockContact]);
    });
  });

  describe('Federated Identity Linking', () => {
    it('should link a federated identity to a contact', async () => {
      await service.linkIdentityToContact(mockContactUrn, mockGoogleAuthUrn);

      expect(mockDbLinksTable.put).toHaveBeenCalledWith({
        contactId: mockContactUrn.toString(),
        authUrn: mockGoogleAuthUrn.toString(),
      });
    });

    it('should retrieve linked identities for a contact', async () => {
      mockDbLinksTable.toArray.mockResolvedValue([mockStorableLink]);

      const result = await service.getLinkedIdentities(mockContactUrn);

      expect(mockDbLinksTable.where).toHaveBeenCalledWith('contactId');
      expect(mockDbLinksTable.equals).toHaveBeenCalledWith(
        mockContactUrn.toString()
      );

      expect(result.length).toBe(1);
      expect(result[0]).toBeInstanceOf(URN);
      expect(result[0].toString()).toBe(mockGoogleAuthUrn.toString());
    });

    it('should find a contact by auth URN if link exists', async () => {
      mockDbLinksTable.first.mockResolvedValue(mockStorableLink);

      const result = await service.findContactByAuthUrn(mockGoogleAuthUrn);

      expect(mockDbLinksTable.where).toHaveBeenCalledWith('authUrn');
      expect(mockDbLinksTable.equals).toHaveBeenCalledWith(
        mockGoogleAuthUrn.toString()
      );
      expect(mockDbLinksTable.first).toHaveBeenCalled();
      expect(mockDbTable.get).toHaveBeenCalledWith(mockContactUrn.toString());
      expect(result).toEqual(mockContact);
    });
  });

  describe('Gatekeeper', () => {
    it('should add to pending list', async () => {
      await service.addToPending(mockStrangerUrn);
      expect(mockDbPendingTable.put).toHaveBeenCalledWith(
        expect.objectContaining({
          urn: mockStrangerUrn.toString(),
          vouchedBy: undefined,
        })
      );
    });
  });

  describe('Smart Sync (Tombstones)', () => {
    it('should update lastModified on save', async () => {
      const before = new Date().getTime();
      await service.saveContact(mockContact);

      const putCall = mockDbTable.put.mock.calls[0][0];
      const savedTime = new Date(putCall.lastModified).getTime();
      expect(savedTime).toBeGreaterThanOrEqual(before);
    });

    it('should create tombstone on delete', async () => {
      await service.deleteContact(mockContactUrn);
      expect(mockDbTombstonesTable.put).toHaveBeenCalled();
    });
  });
});
