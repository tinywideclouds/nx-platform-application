import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContactsStorageService } from './contacts-storage.service';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

import {
  ContactsDatabase,
  StorableContact,
  StorableGroup,
  ContactMapper,
  GroupMapper,
} from '@nx-platform-application/contacts-persistence';

// ✅ FIX: Use a factory to ensure distinct spies for each table
const { mockDb } = vi.hoisted(() => {
  const createMockTable = () => ({
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    toArray: vi.fn(),
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    first: vi.fn(),
    orderBy: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    clear: vi.fn(),
    bulkPut: vi.fn(),
  });

  return {
    mockDb: {
      contacts: createMockTable(),
      groups: createMockTable(),
      links: createMockTable(),
      tombstones: createMockTable(),
      pending: createMockTable(),
      blocked: createMockTable(),
      transaction: vi.fn(async (_, __, cb) => cb()),
    },
  };
});

const mockUrn = URN.parse('urn:contacts:user:123');
const mockContact: StorableContact = {
  id: mockUrn.toString(),
  alias: 'test',
  firstName: 'Test',
  surname: 'User',
  email: 'test@users.com',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {},
  lastModified: '2023-01-01T00:00:00Z' as ISODateTimeString,
};

const mockGroupUrn = URN.parse('urn:contacts:group:abc');
const mockStorableGroup: StorableGroup = {
  id: mockGroupUrn.toString(),
  name: 'Family Group',
  description: '',
  scope: 'local',
  contactIds: [],
  members: [],
  lastModified: '2023-01-01T00:00:00Z' as ISODateTimeString,
};

describe('ContactsStorageService (Address Book)', () => {
  let service: ContactsStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ContactsStorageService,
        { provide: ContactsDatabase, useValue: mockDb },
        ContactMapper,
        GroupMapper,
      ],
    });
    service = TestBed.inject(ContactsStorageService);

    // ✅ Setup returns on DISTINCT spies
    mockDb.contacts.get.mockResolvedValue(mockContact);
    mockDb.contacts.toArray.mockResolvedValue([mockContact]);

    mockDb.groups.get.mockResolvedValue(mockStorableGroup);
    mockDb.groups.toArray.mockResolvedValue([mockStorableGroup]);
  });

  // --- CONTACTS TESTS ---
  describe('Contacts', () => {
    it('should save a contact', async () => {
      await service.saveContact({
        id: mockUrn,
        alias: 'test',
        firstName: 'Test',
        surname: 'User',
        email: 'test@users.com',
        phoneNumbers: [],
        emailAddresses: [],
        serviceContacts: {},
        lastModified: '2023-01-01T00:00:00Z' as ISODateTimeString,
      });
      expect(mockDb.contacts.put).toHaveBeenCalled();
    });

    it('should retrieve a contact by ID', async () => {
      const c = await service.getContact(mockUrn);
      expect(c).toBeDefined();
      // This will now pass because mockDb.contacts.get is distinct
      expect(c?.id.toString()).toBe(mockUrn.toString());
    });
  });

  // --- GROUPS TESTS (Address Book) ---
  describe('Groups', () => {
    it('should save a group', async () => {
      await service.saveGroup({
        id: mockGroupUrn,
        name: 'Family Group',
        scope: 'local',
        members: [],
      });
      expect(mockDb.groups.put).toHaveBeenCalled();
    });

    it('should retrieve a group by ID', async () => {
      const g = await service.getGroup(mockGroupUrn);
      expect(g).toBeDefined();
      expect(g?.name).toBe('Family Group');
    });

    it('should retrieve groups by scope', async () => {
      await service.getGroupsByScope('local');
      expect(mockDb.groups.where).toHaveBeenCalledWith('scope');
      expect(mockDb.groups.equals).toHaveBeenCalledWith('local');
    });

    it('should retrieve groups by parent ID', async () => {
      const parentUrn = URN.parse('urn:contacts:group:parent');
      await service.getGroupsByParent(parentUrn);
      expect(mockDb.groups.where).toHaveBeenCalledWith('parentId');
      expect(mockDb.groups.equals).toHaveBeenCalledWith(parentUrn.toString());
    });
  });

  // --- SYSTEM TESTS ---
  it('should clear the database fully', async () => {
    await service.clearDatabase();
    expect(mockDb.contacts.clear).toHaveBeenCalled();
    expect(mockDb.groups.clear).toHaveBeenCalled();
    expect(mockDb.links.clear).toHaveBeenCalled();
  });
});
