// libs/contacts/contacts-data-access/src/lib/contacts.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
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
  StorableBlockedIdentity,
  StorablePendingIdentity,
} from './models/contacts';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

// --- Mocks ---
const {
  mockDbTable,
  mockDbGroupTable,
  mockDbLinksTable,
  mockDbBlockedTable,
  mockDbPendingTable,
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
  };

  const groupTableMock = {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    orderBy: vi.fn(() => groupTableMock),
    where: vi.fn(() => groupTableMock),
    equals: vi.fn(() => groupTableMock),
    toArray: vi.fn(),
  };

  // Mock for the identity_links table
  const linksTableMock = {
    put: vi.fn(),
    where: vi.fn(() => linksTableMock),
    equals: vi.fn(() => linksTableMock),
    toArray: vi.fn(),
    first: vi.fn(),
  };

  // Mock for blocked_identities table
  const blockedTableMock = {
    put: vi.fn(),
    where: vi.fn(() => blockedTableMock),
    equals: vi.fn(() => blockedTableMock),
    toArray: vi.fn(),
    bulkDelete: vi.fn(),
  };

  // Mock for pending_identities table
  const pendingTableMock = {
    put: vi.fn(),
    where: vi.fn(() => pendingTableMock),
    equals: vi.fn(() => pendingTableMock),
    first: vi.fn(),
    toArray: vi.fn(),
    bulkDelete: vi.fn(),
  };

  return {
    mockDbTable: tableMock,
    mockDbGroupTable: groupTableMock,
    mockDbLinksTable: linksTableMock,
    mockDbBlockedTable: blockedTableMock,
    mockDbPendingTable: pendingTableMock,
    mockContactsDb: {
      contacts: tableMock,
      contactGroups: groupTableMock,
      identity_links: linksTableMock,
      blocked_identities: blockedTableMock,
      pending_identities: pendingTableMock,
      transaction: vi.fn(async (_mode, _tables, callback) => await callback()),
    },
  };
});

// --- Fixtures ---

// --- DOMAIN FIXTURES (with URNs) ---
const mockContactUrn = URN.parse('urn:sm:user:user-123');
const mockGroupUrn = URN.parse('urn:sm:group:grp-abc');
const mockOtherContactUrn = URN.parse('urn:sm:user:user-456');
const mockServiceContactUrn = URN.parse('urn:sm:service:msg-uuid-1');

// Federated & Gatekeeper URNs
const mockGoogleAuthUrn = URN.parse('urn:auth:google:bob-123');
const mockSpammerUrn = URN.parse('urn:auth:google:spammer');
const mockStrangerUrn = URN.parse('urn:auth:apple:stranger');
const mockVoucherUrn = URN.parse('urn:sm:user:bob-contact'); // Bob (Local Contact)

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
};

const mockGroup: ContactGroup = {
  id: mockGroupUrn,
  name: 'Family',
  contactIds: [mockContactUrn, mockOtherContactUrn],
};

// --- STORABLE FIXTURES (with Strings) ---
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
};

const mockStorableGroup: StorableGroup = {
  id: mockGroupUrn.toString(),
  name: 'Family',
  contactIds: [mockContactUrn.toString(), mockOtherContactUrn.toString()],
};

const mockStorableLink: StorableIdentityLink = {
  id: 1,
  contactId: mockContactUrn.toString(),
  authUrn: mockGoogleAuthUrn.toString(),
};

// --- Test Suite ---

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

    // Default mock returns
    mockDbTable.get.mockResolvedValue(mockStorableContact);
    mockDbTable.first.mockResolvedValue(mockStorableContact);
    mockDbTable.toArray.mockResolvedValue([mockStorableContact]);
    mockDbTable.bulkGet.mockResolvedValue([mockStorableContact]);

    mockDbGroupTable.get.mockResolvedValue(mockStorableGroup);
    mockDbGroupTable.toArray.mockResolvedValue([mockStorableGroup]);

    // Default mock for links
    mockDbLinksTable.toArray.mockResolvedValue([]);
    mockDbLinksTable.first.mockResolvedValue(undefined);

    // Default mock for gatekeeper
    mockDbBlockedTable.toArray.mockResolvedValue([]);
    mockDbPendingTable.first.mockResolvedValue(undefined);
    mockDbPendingTable.toArray.mockResolvedValue([]);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('CRUD Operations', () => {
    it('should save a contact (mapping to storable)', async () => {
      await service.saveContact(mockContact);
      expect(mockContactsDb.contacts.put).toHaveBeenCalledWith(
        mockStorableContact
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
      const storableChanges: Partial<StorableContact> = { alias: 'New Alias' };

      await service.updateContact(mockContactUrn, changes);
      expect(mockContactsDb.contacts.update).toHaveBeenCalledWith(
        mockContactUrn.toString(),
        storableChanges
      );
    });

    it('should delete a contact', async () => {
      await service.deleteContact(mockContactUrn);
      expect(mockContactsDb.contacts.delete).toHaveBeenCalledWith(
        mockContactUrn.toString()
      );
    });
  });

  describe('Search Operations', () => {
    it('should find by email', async () => {
      const searchEmail = 'work@example.com';
      const result = await service.findByEmail(searchEmail);

      expect(mockDbTable.where).toHaveBeenCalledWith('emailAddresses');
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
      const storableBatch = [mockStorableContact];
      await service.bulkUpsert(batch);

      expect(mockContactsDb.transaction).toHaveBeenCalled();
      expect(mockContactsDb.contacts.bulkPut).toHaveBeenCalledWith(
        storableBatch
      );
    });
  });

  describe('Group Operations', () => {
    it('should save a group', async () => {
      await service.saveGroup(mockGroup);
      expect(mockContactsDb.contactGroups.put).toHaveBeenCalledWith(
        mockStorableGroup
      );
    });

    it('should get a group by ID', async () => {
      const result = await service.getGroup(mockGroupUrn);
      expect(mockContactsDb.contactGroups.get).toHaveBeenCalledWith(
        mockGroupUrn.toString()
      );
      expect(result).toEqual(mockGroup);
    });

    it('should delete a group', async () => {
      await service.deleteGroup(mockGroupUrn);
      expect(mockContactsDb.contactGroups.delete).toHaveBeenCalledWith(
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

    it('should return an empty array if group not found', async () => {
      const notFoundUrn = URN.parse('urn:sm:group:grp-not-found');
      mockDbGroupTable.get.mockResolvedValue(undefined);

      const result = await service.getContactsForGroup(notFoundUrn);

      expect(mockDbGroupTable.get).toHaveBeenCalledWith(notFoundUrn.toString());
      expect(result).toEqual([]);
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

    it('should retrieve ALL identity links', async () => {
      mockDbLinksTable.toArray.mockResolvedValue([mockStorableLink]);

      const result = await service.getAllIdentityLinks();

      expect(mockDbLinksTable.toArray).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].authUrn).toBeInstanceOf(URN);
      expect(result[0].authUrn.toString()).toBe(mockGoogleAuthUrn.toString());
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

  describe('Gatekeeper: Blocking', () => {
    it('should block an identity', async () => {
      await service.blockIdentity(mockSpammerUrn, 'Spam');
      expect(mockDbBlockedTable.put).toHaveBeenCalledWith(
        expect.objectContaining({
          urn: mockSpammerUrn.toString(),
          reason: 'Spam',
        })
      );
    });

    it('should unblock an identity', async () => {
      // Mock finding the record to get its ID
      mockDbBlockedTable.toArray.mockResolvedValue([
        { id: 123, urn: mockSpammerUrn.toString() },
      ]);

      await service.unblockIdentity(mockSpammerUrn);

      expect(mockDbBlockedTable.where).toHaveBeenCalledWith('urn');
      expect(mockDbBlockedTable.equals).toHaveBeenCalledWith(
        mockSpammerUrn.toString()
      );
      expect(mockDbBlockedTable.bulkDelete).toHaveBeenCalledWith([123]);
    });

    it('should retrieve all blocked identity URNs', async () => {
      mockDbBlockedTable.toArray.mockResolvedValue([
        { urn: 'urn:auth:a' },
        { urn: 'urn:auth:b' },
      ]);

      const result = await service.getAllBlockedIdentityUrns();
      expect(result).toEqual(['urn:auth:a', 'urn:auth:b']);
    });
  });

  describe('Gatekeeper: The Waiting Room (Pending)', () => {
    it('should add an unknown stranger to pending', async () => {
      await service.addToPending(mockStrangerUrn); // No voucher
      expect(mockDbPendingTable.put).toHaveBeenCalledWith(
        expect.objectContaining({
          urn: mockStrangerUrn.toString(),
          vouchedBy: undefined,
        })
      );
    });

    it('should add a vouched identity to pending', async () => {
      await service.addToPending(mockStrangerUrn, mockVoucherUrn, 'Intro');
      expect(mockDbPendingTable.put).toHaveBeenCalledWith(
        expect.objectContaining({
          urn: mockStrangerUrn.toString(),
          vouchedBy: mockVoucherUrn.toString(),
          note: 'Intro',
        })
      );
    });

    it('should delete a pending record (when approved or blocked)', async () => {
      mockDbPendingTable.toArray.mockResolvedValue([
        { id: 99, urn: mockStrangerUrn.toString() },
      ]);

      await service.deletePending(mockStrangerUrn);

      expect(mockDbPendingTable.where).toHaveBeenCalledWith('urn');
      expect(mockDbPendingTable.equals).toHaveBeenCalledWith(
        mockStrangerUrn.toString()
      );
      expect(mockDbPendingTable.bulkDelete).toHaveBeenCalledWith([99]);
    });

    it('should get a pending identity by URN', async () => {
      const mockStorable: StorablePendingIdentity = {
        id: 1,
        urn: mockStrangerUrn.toString(),
        firstSeenAt: '2023-01-01T12:00:00Z' as ISODateTimeString,
        vouchedBy: mockVoucherUrn.toString(),
      };
      mockDbPendingTable.first.mockResolvedValue(mockStorable);

      const result = await service.getPendingIdentity(mockStrangerUrn);

      expect(result).toBeTruthy();
      expect(result?.urn).toEqual(mockStrangerUrn);
      expect(result?.vouchedBy).toEqual(mockVoucherUrn);
    });
  });

  describe('LiveQuery Streams', () => {
    it('should create contacts$ stream', () => {
      expect(service.contacts$).toBeTruthy();
    });

    it('should create groups$ stream', () => {
      expect(service.groups$).toBeTruthy();
    });

    it('should create blocked$ stream', () => {
      expect(service.blocked$).toBeTruthy();
    });

    it('should create pending$ stream', () => {
      expect(service.pending$).toBeTruthy();
    });
  });
});