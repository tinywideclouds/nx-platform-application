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
} from './models/contacts';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

// --- Mocks ---
const { mockDbTable, mockDbGroupTable, mockDbLinksTable, mockContactsDb } =
  vi.hoisted(() => {
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

    // Mock for the new identity_links table
    const linksTableMock = {
      put: vi.fn(),
      where: vi.fn(() => linksTableMock),
      equals: vi.fn(() => linksTableMock),
      toArray: vi.fn(),
      first: vi.fn(),
    };

    return {
      mockDbTable: tableMock,
      mockDbGroupTable: groupTableMock,
      mockDbLinksTable: linksTableMock,
      mockContactsDb: {
        contacts: tableMock,
        contactGroups: groupTableMock,
        identity_links: linksTableMock,
        transaction: vi.fn(
          async (_mode, _tables, callback) => await callback()
        ),
      },
    };
  });

// --- Fixtures ---

// --- DOMAIN FIXTURES (with URNs) ---
const mockContactUrn = URN.parse('urn:sm:user:user-123');
const mockGroupUrn = URN.parse('urn:sm:group:grp-abc');
const mockOtherContactUrn = URN.parse('urn:sm:user:user-456');
const mockServiceContactUrn = URN.parse('urn:sm:service:msg-uuid-1');

// New Federated URNs
const mockGoogleAuthUrn = URN.parse('urn:auth:google:bob-123');
const mockAppleAuthUrn = URN.parse('urn:auth:apple:bob-456');

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
    it('should link a federated identity to a contact (storing as strings)', async () => {
      await service.linkIdentityToContact(mockContactUrn, mockGoogleAuthUrn);

      expect(mockDbLinksTable.put).toHaveBeenCalledWith({
        contactId: mockContactUrn.toString(),
        authUrn: mockGoogleAuthUrn.toString(),
      });
    });

    it('should retrieve linked identities for a contact (returning URNs)', async () => {
      // Mock the DB returning a storable link
      mockDbLinksTable.toArray.mockResolvedValue([mockStorableLink]);

      const result = await service.getLinkedIdentities(mockContactUrn);

      expect(mockDbLinksTable.where).toHaveBeenCalledWith('contactId');
      expect(mockDbLinksTable.equals).toHaveBeenCalledWith(
        mockContactUrn.toString()
      );

      expect(result.length).toBe(1);
      expect(result[0]).toBeInstanceOf(URN);
      // Verify equality as strings to ensure value correctness
      expect(result[0].toString()).toBe(mockGoogleAuthUrn.toString());
    });

    it('should find a contact by auth URN if link exists', async () => {
      // 1. Mock that the link lookup finds a link
      mockDbLinksTable.first.mockResolvedValue(mockStorableLink);
      // 2. Mock that the contact lookup finds the contact (default behavior)

      const result = await service.findContactByAuthUrn(mockGoogleAuthUrn);

      // Verify link lookup
      expect(mockDbLinksTable.where).toHaveBeenCalledWith('authUrn');
      expect(mockDbLinksTable.equals).toHaveBeenCalledWith(
        mockGoogleAuthUrn.toString()
      );
      expect(mockDbLinksTable.first).toHaveBeenCalled();

      // Verify contact lookup
      expect(mockDbTable.get).toHaveBeenCalledWith(mockContactUrn.toString());

      // Verify result
      expect(result).toEqual(mockContact);
    });

    it('should return null if no link exists for auth URN', async () => {
      // Mock link lookup returning undefined
      mockDbLinksTable.first.mockResolvedValue(undefined);

      const result = await service.findContactByAuthUrn(mockAppleAuthUrn);

      expect(mockDbLinksTable.where).toHaveBeenCalledWith('authUrn');
      expect(mockDbLinksTable.equals).toHaveBeenCalledWith(
        mockAppleAuthUrn.toString()
      );
      expect(mockDbTable.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('LiveQuery Streams', () => {
    it('should create contacts$ stream', () => {
      expect(service.contacts$).toBeTruthy();
    });

    it('should create groups$ stream', () => {
      expect(service.groups$).toBeTruthy();
    });
  });
});