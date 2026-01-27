import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContactsStorageService } from './contacts-storage.service';
import { firstValueFrom } from 'rxjs';
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
} from '@nx-platform-application/contacts-infrastructure-indexed-db';

const { mockDb } = vi.hoisted(() => {
  const createMockTable = () => ({
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    toArray: vi.fn().mockResolvedValue([]),
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    first: vi.fn(),
    orderBy: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    clear: vi.fn(),
    bulkPut: vi.fn(),
    bulkGet: vi.fn().mockResolvedValue([]),
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
  lastModified: '2023-01-01T00:00:00Z' as ISODateTimeString,
};

const mockGroupUrn = URN.parse('urn:contacts:group:abc');
const mockStorableGroup: StorableGroup = {
  id: mockGroupUrn.toString(),
  name: 'Family Group',
  description: '',
  contactIds: [],
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

    mockDb.contacts.get.mockResolvedValue(mockContact);
    mockDb.contacts.toArray.mockResolvedValue([mockContact]);

    mockDb.groups.get.mockResolvedValue(mockStorableGroup);
    mockDb.groups.toArray.mockResolvedValue([mockStorableGroup]);

    mockDb.links.toArray.mockResolvedValue([]);
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
      expect(c?.id.toString()).toBe(mockUrn.toString());
    });

    it('should clean up links when deleting a contact', async () => {
      await service.deleteContact(mockUrn);

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.contacts.delete).toHaveBeenCalledWith(mockUrn.toString());
      expect(mockDb.links.where).toHaveBeenCalledWith('contactId');
      expect(mockDb.links.equals).toHaveBeenCalledWith(mockUrn.toString());
    });
  });

  // --- GROUPS TESTS ---
  describe('Groups', () => {
    it('should save a group', async () => {
      await service.saveGroup({
        id: mockGroupUrn,
        name: 'Family Group',
        memberUrns: [],
        lastModified: '' as ISODateTimeString,
      });
      expect(mockDb.groups.put).toHaveBeenCalled();
    });

    it('should retrieve a group by ID', async () => {
      const g = await service.getGroup(mockGroupUrn);
      expect(g).toBeDefined();
      expect(g?.name).toBe('Family Group');
    });
  });

  describe('Local Groups Logic', () => {
    it('should fetch contacts for a group using V9 logic', async () => {
      const contactUrn = URN.parse('urn:contacts:user:1');
      const groupUrn = URN.parse('urn:contacts:group:1');

      // Mock Group Record with contactIds
      mockDb.groups.get.mockResolvedValue({
        id: groupUrn.toString(),
        name: 'Friends',
        directoryId: '', // Local
        contactIds: [contactUrn.toString()],
        lastModified: '2023-01-01T00:00:00Z',
      });

      // Mock Contacts Bulk Get
      mockDb.contacts.bulkGet = vi.fn().mockResolvedValue([
        {
          id: contactUrn.toString(),
          alias: 'Alice',
          lastModified: '2023-01-01T00:00:00Z',
        },
      ]);

      const contacts = await service.getContactsForGroup(groupUrn);

      expect(contacts).toHaveLength(1);
      expect(contacts[0].alias).toBe('Alice');
      expect(mockDb.contacts.bulkGet).toHaveBeenCalledWith([
        contactUrn.toString(),
      ]);
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
