import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Firestore } from '@google-cloud/firestore';
// Import BOTH functions
import { getUserProfile, findUserByEmail } from './firestore.js';
import type { User } from '@nx-platform-application/platform-types';

// --- FIRESTORE MOCK ---
// We mock the entire @google-cloud/firestore library to have full control
// over its behavior without making any real database calls.
const mockDoc = vi.fn();

// This is the mock for the query chain: collection().where().limit().get()
const mockQueryGet = vi.fn();
const mockQueryLimit = vi.fn(() => ({ get: mockQueryGet }));
const mockQueryWhere = vi.fn(() => ({ limit: mockQueryLimit }));

const mockCollection = vi.fn(() => ({
  where: mockQueryWhere,
  doc: mockDoc,
}));

vi.mock('@google-cloud/firestore', () => {
  return {
    Firestore: vi.fn(() => ({
      collection: mockCollection,
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

  describe('getUserProfile', () => {
    it('should return a user profile if the document exists', async () => {
      const userId = 'existing-user-id';
      const userProfile: User = {
        id: '1df',
        email: 'found@example.com',
        alias: 'FoundUser',
      };

      // Configure the mock 'get' function to return a document
      const mockDocSnapshot = {
        exists: true,
        data: () => userProfile,
      };
      mockDoc.mockReturnValue({
        get: vi.fn().mockResolvedValue(mockDocSnapshot),
      });

      const result = await getUserProfile(db, userId);

      // Verify that the correct document was requested
      expect(mockCollection).toHaveBeenCalledWith('authorized_users');
      expect(mockDoc).toHaveBeenCalledWith(userId);
      expect(result).toEqual(userProfile);
    });

    it('should return null if the document does not exist', async () => {
      const userId = 'non-existent-user-id';

      // Configure the mock 'get' function to return a non-existent snapshot
      const mockDocSnapshot = {
        exists: false,
      };
      mockDoc.mockReturnValue({
        get: vi.fn().mockResolvedValue(mockDocSnapshot),
      });

      const result = await getUserProfile(db, userId);

      expect(mockDoc).toHaveBeenCalledWith(userId);
      expect(result).toBeNull();
    });
  });

  // --- COMPLETED TEST SUITE FOR findUserByEmail ---
  describe('findUserByEmail', () => {
    it('should return an authenticated user if found by email', async () => {
      // ARRANGE
      const userEmail = 'found@example.com';
      const userData: User = {
        id: 'user-id-123',
        email: userEmail,
        alias: 'FoundUser',
      };
      const mockDoc = {
        id: 'user-id-123',
        data: () => userData,
      };
      const mockSnapshot = {
        empty: false,
        docs: [mockDoc],
      };
      mockQueryGet.mockResolvedValue(mockSnapshot);

      // ACT
      const result = await findUserByEmail(db, userEmail);

      // ASSERT
      expect(mockCollection).toHaveBeenCalledWith('authorized_users');
      expect(mockQueryWhere).toHaveBeenCalledWith('email', '==', userEmail);
      expect(mockQueryLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        id: 'user-id-123',
        email: userEmail,
        alias: 'FoundUser',
      });
    });

    it('should return null if no user is found by email', async () => {
      // ARRANGE
      const userEmail = 'notfound@example.com';
      const mockSnapshot = {
        empty: true,
        docs: [],
      };
      mockQueryGet.mockResolvedValue(mockSnapshot);

      // ACT
      const result = await findUserByEmail(db, userEmail);

      // ASSERT
      expect(mockQueryWhere).toHaveBeenCalledWith('email', '==', userEmail);
      expect(result).toBeNull();
    });
  });
  // --- END OF NEW TEST SUITE ---
});