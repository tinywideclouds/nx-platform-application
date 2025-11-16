// libs/contacts/contacts-data-access/src/lib/contacts.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ContactsStorageService } from './contacts.service';
import { ContactsDatabase } from './db/contacts.database';
// --- 1. Import all models, including Storable ---
import {
  Contact,
  ContactGroup,
  StorableContact,
  StorableGroup,
  ServiceContact,
  StorableServiceContact,
} from './models/contacts';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

// --- Mocks (Unchanged) ---
const { mockDbTable, mockDbGroupTable, mockContactsDb } = vi.hoisted(() => {
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

  return {
    mockDbTable: tableMock,
    mockDbGroupTable: groupTableMock,
    mockContactsDb: {
      contacts: tableMock,
      contactGroups: groupTableMock,
      transaction: vi.fn(async (_mode, _tables, callback) => await callback()),
    },
  };
});

// --- 2. Fixtures ---

// --- DOMAIN FIXTURES (with URNs) ---
// These are what the app uses and what the service's public methods accept/return.
const mockContactUrn = URN.parse('urn:sm:user:user-123');
const mockGroupUrn = URN.parse('urn:sm:group:grp-abc');
const mockOtherContactUrn = URN.parse('urn:sm:user:user-456');
const mockServiceContactUrn = URN.parse('urn:sm:service:msg-uuid-1');

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
// These are what the mock database will return.
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

// --- 3. Test Suite ---

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

    // Default mock returns for contacts table (return STORABLE objects)
    mockDbTable.get.mockResolvedValue(mockStorableContact);
    mockDbTable.first.mockResolvedValue(mockStorableContact);
    mockDbTable.toArray.mockResolvedValue([mockStorableContact]);
    mockDbTable.bulkGet.mockResolvedValue([mockStorableContact]);

    // Default mock returns for groups table (return STORABLE objects)
    mockDbGroupTable.get.mockResolvedValue(mockStorableGroup);
    mockDbGroupTable.toArray.mockResolvedValue([mockStorableGroup]);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('CRUD Operations', () => {
    it('should save a contact (mapping to storable)', async () => {
      await service.saveContact(mockContact);
      // Expect the DB to have been called with the storable version
      expect(mockContactsDb.contacts.put).toHaveBeenCalledWith(
        mockStorableContact
      );
    });

    it('should get a contact by ID (mapping from storable)', async () => {
      // Call with URN
      const result = await service.getContact(mockContactUrn);
      // Expect DB to be called with string
      expect(mockContactsDb.contacts.get).toHaveBeenCalledWith(
        mockContactUrn.toString()
      );
      // Expect result to be the DOMAIN object
      expect(result).toEqual(mockContact);
    });

    it('should update a contact', async () => {
      const changes: Partial<Contact> = { alias: 'New Alias' };
      const storableChanges: Partial<StorableContact> = { alias: 'New Alias' };

      await service.updateContact(mockContactUrn, changes);
      // Expect DB to be called with string key and storable changes
      expect(mockContactsDb.contacts.update).toHaveBeenCalledWith(
        mockContactUrn.toString(),
        storableChanges
      );
    });

    it('should delete a contact', async () => {
      await service.deleteContact(mockContactUrn);
      // Expect DB to be called with string
      expect(mockContactsDb.contacts.delete).toHaveBeenCalledWith(
        mockContactUrn.toString()
      );
    });
  });

  describe('Search Operations', () => {
    it('should find by email (mapping from storable)', async () => {
      const searchEmail = 'work@example.com';
      const result = await service.findByEmail(searchEmail);

      expect(mockDbTable.where).toHaveBeenCalledWith('emailAddresses');
      expect(mockDbTable.equals).toHaveBeenCalledWith(searchEmail);
      // Expect result to be the DOMAIN object
      expect(result).toEqual(mockContact);
    });

    it('should find by phone (mapping from storable)', async () => {
      const searchPhone = '+15550199';
      const result = await service.findByPhone(searchPhone);

      expect(mockDbTable.where).toHaveBeenCalledWith('phoneNumbers');
      expect(mockDbTable.equals).toHaveBeenCalledWith(searchPhone);
      // Expect result to be the DOMAIN object
      expect(result).toEqual(mockContact);
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk upsert (mapping to storable)', async () => {
      const batch = [mockContact];
      const storableBatch = [mockStorableContact];
      await service.bulkUpsert(batch);

      expect(mockContactsDb.transaction).toHaveBeenCalled();
      // Expect DB to be called with storable batch
      expect(mockContactsDb.contacts.bulkPut).toHaveBeenCalledWith(
        storableBatch
      );
    });
  });

  describe('Group Operations', () => {
    it('should save a group (mapping to storable)', async () => {
      await service.saveGroup(mockGroup);
      // Expect DB to be called with storable version
      expect(mockContactsDb.contactGroups.put).toHaveBeenCalledWith(
        mockStorableGroup
      );
    });

    it('should get a group by ID (mapping from storable)', async () => {
      // Call with URN
      const result = await service.getGroup(mockGroupUrn);
      // Expect DB to be called with string
      expect(mockContactsDb.contactGroups.get).toHaveBeenCalledWith(
        mockGroupUrn.toString()
      );
      // Expect result to be the DOMAIN object
      expect(result).toEqual(mockGroup);
    });

    it('should delete a group', async () => {
      await service.deleteGroup(mockGroupUrn);
      // Expect DB to be called with string
      expect(mockContactsDb.contactGroups.delete).toHaveBeenCalledWith(
        mockGroupUrn.toString()
      );
    });

    it('should get groups for a specific contact (mapping from storable)', async () => {
      // Call with URN
      const result = await service.getGroupsForContact(mockContactUrn);

      // Expect query to use string
      expect(mockDbGroupTable.where).toHaveBeenCalledWith('contactIds');
      expect(mockDbGroupTable.equals).toHaveBeenCalledWith(
        mockContactUrn.toString()
      );
      // Expect result to be the DOMAIN object
      expect(result).toEqual([mockGroup]);
    });

    it('should get contacts for a specific group (mapping from storable)', async () => {
      // Call with URN
      const result = await service.getContactsForGroup(mockGroupUrn);

      // 1. getGroup is called, which calls db.get with string
      expect(mockDbGroupTable.get).toHaveBeenCalledWith(mockGroupUrn.toString());
      
      // 2. db.bulkGet is called with string IDs from the storable group
      expect(mockDbTable.bulkGet).toHaveBeenCalledWith(
        mockStorableGroup.contactIds
      );
      
      // 3. Expect result to be the DOMAIN object
      expect(result).toEqual([mockContact]);
    });

    it('should return an empty array if group not found', async () => {
      const notFoundUrn = URN.parse('urn:sm:group:grp-not-found');
      mockDbGroupTable.get.mockResolvedValue(undefined);
      
      let result = await service.getContactsForGroup(notFoundUrn);
      
      expect(mockDbGroupTable.get).toHaveBeenCalledWith(notFoundUrn.toString());
      expect(result).toEqual([]);
    });
  });

  describe('LiveQuery Streams', () => {
    // Note: We can't easily test the stream's mapper function here
    // as it's wrapped by `liveQuery`. We trust the mappers
    // as they are tested in the CRUD operations.
    it('should create contacts$ stream', () => {
      expect(service.contacts$).toBeTruthy();
    });

    it('should create groups$ stream', () => {
      expect(service.groups$).toBeTruthy();
    });
  });
});