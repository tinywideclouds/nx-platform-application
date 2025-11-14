// libs/contacts/contacts-data-access/src/lib/contacts.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ContactsStorageService } from './contacts.service';
import { ContactsDatabase } from './db/contacts.database';
// 1. Import the new ContactGroup model
import { Contact, ContactGroup } from './models/contacts';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

// --- Mocks ---
const { mockDbTable, mockDbGroupTable, mockContactsDb } = vi.hoisted(() => {
  const tableMock = {
    // Standard CRUD
    put: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    bulkPut: vi.fn(),
    bulkGet: vi.fn(), // 2. Add bulkGet for getContactsForGroup

    // Querying
    orderBy: vi.fn(() => tableMock),
    where: vi.fn(() => tableMock),
    equals: vi.fn(() => tableMock),
    toArray: vi.fn(),
    first: vi.fn(),
  };

  // 3. Create a separate mock for the new table
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
    mockDbGroupTable: groupTableMock, // 4. Export the new mock
    mockContactsDb: {
      contacts: tableMock,
      contactGroups: groupTableMock, // 5. Add it to the mock DB
      // Mock transaction to immediately execute the callback
      transaction: vi.fn(async (_mode, _tables, callback) => await callback()),
    },
  };
});

// --- Fixtures ---
const mockContact: Contact = {
  id: 'user-123',
  alias: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  surname: 'Doe',
  phoneNumbers: ['+15550199'],
  emailAddresses: ['john@example.com', 'work@example.com'],
  serviceContacts: {
    messenger: {
      id: 'msg-uuid-1',
      alias: 'jd_messenger',
      lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
    },
  },
};

// 6. Define a new fixture for ContactGroup
const mockGroup: ContactGroup = {
  id: 'grp-abc',
  name: 'Family',
  contactIds: ['user-123', 'user-456'],
};

describe('ContactsStorageService', () => {
  let service: ContactsStorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ContactsStorageService,
        // Clean Architecture: Inject the mock object instead of the real DB class
        { provide: ContactsDatabase, useValue: mockContactsDb },
      ],
    });

    service = TestBed.inject(ContactsStorageService);

    // Default mock returns for contacts table
    mockDbTable.get.mockResolvedValue(mockContact);
    mockDbTable.first.mockResolvedValue(mockContact);
    mockDbTable.toArray.mockResolvedValue([mockContact]);
    mockDbTable.bulkGet.mockResolvedValue([mockContact]); // 7. Add bulkGet default

    // 8. Default mock returns for groups table
    mockDbGroupTable.get.mockResolvedValue(mockGroup);
    mockDbGroupTable.toArray.mockResolvedValue([mockGroup]);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('CRUD Operations', () => {
    it('should save a contact', async () => {
      await service.saveContact(mockContact);
      expect(mockContactsDb.contacts.put).toHaveBeenCalledWith(mockContact);
    });

    it('should get a contact by ID', async () => {
      const result = await service.getContact('user-123');
      expect(mockContactsDb.contacts.get).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockContact);
    });

    it('should update a contact', async () => {
      const changes = { alias: 'New Alias' };
      await service.updateContact('user-123', changes);
      expect(mockContactsDb.contacts.update).toHaveBeenCalledWith(
        'user-123',
        changes
      );
    });

    it('should delete a contact', async () => {
      await service.deleteContact('user-123');
      expect(mockContactsDb.contacts.delete).toHaveBeenCalledWith('user-123');
    });
  });

  describe('Search Operations', () => {
    it('should find by email using the multi-entry index', async () => {
      const searchEmail = 'work@example.com';
      const result = await service.findByEmail(searchEmail);

      // Verify it used the index on 'emailAddresses'
      expect(mockDbTable.where).toHaveBeenCalledWith('emailAddresses');
      expect(mockDbTable.equals).toHaveBeenCalledWith(searchEmail);
      expect(result).toEqual(mockContact);
    });

    it('should find by phone using the multi-entry index', async () => {
      const searchPhone = '+15550199';
      const result = await service.findByPhone(searchPhone);

      // Verify it used the index on 'phoneNumbers'
      expect(mockDbTable.where).toHaveBeenCalledWith('phoneNumbers');
      expect(mockDbTable.equals).toHaveBeenCalledWith(searchPhone);
      expect(result).toEqual(mockContact);
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk upsert within a transaction', async () => {
      const batch = [mockContact];
      await service.bulkUpsert(batch);

      expect(mockContactsDb.transaction).toHaveBeenCalled();
      expect(mockContactsDb.contacts.bulkPut).toHaveBeenCalledWith(batch);
    });
  });

  // --- 9. NEW TEST SUITE ---
  describe('Group Operations', () => {
    it('should save a group', async () => {
      await service.saveGroup(mockGroup);
      expect(mockContactsDb.contactGroups.put).toHaveBeenCalledWith(mockGroup);
    });

    it('should get a group by ID', async () => {
      const result = await service.getGroup('grp-abc');
      expect(mockContactsDb.contactGroups.get).toHaveBeenCalledWith('grp-abc');
      expect(result).toEqual(mockGroup);
    });

    it('should delete a group', async () => {
      await service.deleteGroup('grp-abc');
      expect(mockContactsDb.contactGroups.delete).toHaveBeenCalledWith(
        'grp-abc'
      );
    });

    it('should get groups for a specific contact', async () => {
      const contactId = 'user-123';
      const result = await service.getGroupsForContact(contactId);

      // Verify it used the index on 'contactIds'
      expect(mockDbGroupTable.where).toHaveBeenCalledWith('contactIds');
      expect(mockDbGroupTable.equals).toHaveBeenCalledWith(contactId);
      expect(result).toEqual([mockGroup]);
    });

    it('should get contacts for a specific group', async () => {
      const groupId = 'grp-abc';
      const result = await service.getContactsForGroup(groupId);

      // Verify it first gets the group
      expect(mockDbGroupTable.get).toHaveBeenCalledWith(groupId);
      // Then it uses bulkGet with the IDs from that group
      expect(mockDbTable.bulkGet).toHaveBeenCalledWith(mockGroup.contactIds);
      expect(result).toEqual([mockContact]);
    });

    it('should return an empty array if group not found or has no contacts', async () => {
      // Test case 1: Group not found
      mockDbGroupTable.get.mockResolvedValue(undefined);
      let result = await service.getContactsForGroup('grp-not-found');
      expect(result).toEqual([]);

      // Test case 2: Group has no contacts
      mockDbGroupTable.get.mockResolvedValue({
        id: 'grp-empty',
        name: 'Empty',
        contactIds: [],
      });
      result = await service.getContactsForGroup('grp-empty');
      expect(result).toEqual([]);
    });
  });

  // Note: liveQuery logic relies on Dexie's observable implementation.
  // In unit tests with mocks, we primarily verify the query construction
  // (orderBy, where) inside the CRUD tests or by inspecting the calls
  // made when accessing the observable if needed.
});