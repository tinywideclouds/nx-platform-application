import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ContactsStorageService } from './contacts.service';
import { ContactsDatabase } from './db/contacts.database';
import { Contact } from './models/contacts';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

// --- Mocks ---
const { mockDbTable, mockContactsDb } = vi.hoisted(() => {
  const tableMock = {
    // Standard CRUD
    put: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    bulkPut: vi.fn(),
    
    // Querying
    orderBy: vi.fn(() => tableMock),
    where: vi.fn(() => tableMock),
    equals: vi.fn(() => tableMock),
    toArray: vi.fn(),
    first: vi.fn(),
  };

  return {
    mockDbTable: tableMock,
    mockContactsDb: {
      contacts: tableMock,
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
      lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString
    },
  }
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

    // Default mock returns
    mockDbTable.get.mockResolvedValue(mockContact);
    mockDbTable.first.mockResolvedValue(mockContact);
    mockDbTable.toArray.mockResolvedValue([mockContact]);
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
      expect(mockContactsDb.contacts.update).toHaveBeenCalledWith('user-123', changes);
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
  
  // Note: liveQuery logic relies on Dexie's observable implementation. 
  // In unit tests with mocks, we primarily verify the query construction 
  // (orderBy, where) inside the CRUD tests or by inspecting the calls 
  // made when accessing the observable if needed.
});