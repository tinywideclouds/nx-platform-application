import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Firestore } from '@google-cloud/firestore';
import { getUserAddressBook, addContactToAddressBook } from './firestore';
import type { User } from '@nx-platform-application/platform-types';

// --- FIRESTORE MOCK ---
// This mock is more complex because we must mock subcollections.
// We follow the chain: collection -> doc -> collection -> doc -> set
// We also follow: collection -> doc -> collection -> get
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();
const mockSubDoc = vi.fn(() => ({
  set: mockSet,
}));
const mockSubCollection = vi.fn(() => ({
  get: mockGet,
  doc: mockSubDoc,
}));
const mockMainDoc = vi.fn(() => ({
  collection: mockSubCollection,
}));
const mockMainCollection = vi.fn(() => ({
  doc: mockMainDoc,
}));

vi.mock('@google-cloud/firestore', () => {
  return {
    Firestore: vi.fn(() => ({
      collection: mockMainCollection,
    })),
  };
});
// --- END MOCK ---

describe('Firestore Service (Unit)', () => {
  let db: Firestore;

  beforeEach(() => {
    db = new Firestore();
    // Reset all mock function call counters before each test
    vi.clearAllMocks();
  });

  describe('getUserAddressBook', () => {
    const userId = 'owner-id-123';
    const mockUser: User = {
      id: 'contact-id-456',
      email: 'contact@example.com',
      alias: 'Test Contact',
    };

    it('should return a user array if contacts exist', async () => {
      // 1. Configure Mocks
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => ({
              userId: mockUser.id,
              email: mockUser.email,
              alias: mockUser.alias,
            }),
          },
        ],
      };
      mockGet.mockResolvedValue(mockSnapshot);

      // 2. Call Function
      const result = await getUserAddressBook(db, userId);

      // 3. Assertions
      expect(mockMainCollection).toHaveBeenCalledWith('authorized_users');
      expect(mockMainDoc).toHaveBeenCalledWith(userId);
      expect(mockSubCollection).toHaveBeenCalledWith('address_book');
      expect(result).toEqual([mockUser]);
    });

    it('should return an empty array if no contacts exist', async () => {
      // 1. Configure Mocks
      const mockSnapshot = {
        empty: true,
        docs: [],
      };
      mockGet.mockResolvedValue(mockSnapshot);

      // 2. Call Function
      const result = await getUserAddressBook(db, userId);

      // 3. Assertions
      expect(mockSubCollection).toHaveBeenCalledWith('address_book');
      expect(result).toEqual([]);
    });
  });

  describe('addContactToAddressBook', () => {
    it('should call set() with the correct user data', async () => {
      const ownerId = 'owner-id-123';
      const contactToAdd: User = {
        id: 'new-contact-456',
        email: 'new@example.com',
        alias: 'Newbie',
      };

      // 1. Call Function
      await addContactToAddressBook(db, ownerId, contactToAdd);

      // 2. Assertions
      expect(mockMainCollection).toHaveBeenCalledWith('authorized_users');
      expect(mockMainDoc).toHaveBeenCalledWith(ownerId);
      expect(mockSubCollection).toHaveBeenCalledWith('address_book');
      expect(mockSubDoc).toHaveBeenCalledWith(contactToAdd.id);
      expect(mockSet).toHaveBeenCalledWith({
        alias: contactToAdd.alias,
        email: contactToAdd.email,
        userId: contactToAdd.id,
      });
    });
  });
});
