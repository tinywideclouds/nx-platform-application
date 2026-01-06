// apps/platform/node-identity-service/src/internal/firestore.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Firestore, WriteResult } from '@google-cloud/firestore';
import {
  getUserProfile,
  findUserByEmail,
  isEmailBlocked,
  addAuthorizedUser,
} from './firestore.js';
import { User, URN } from '@nx-platform-application/platform-types';

// --- FIRESTORE MOCK ---
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDoc = vi.fn((docId) => ({
  get: mockDocGet,
  set: mockDocSet,
  id: docId,
}));

const mockQueryGet = vi.fn();
const mockQueryLimit = vi.fn(() => ({ get: mockQueryGet }));
const mockQueryWhere = vi.fn(() => ({ limit: mockQueryLimit }));

const mockCollection = vi.fn(() => ({
  where: mockQueryWhere,
  doc: mockDoc,
}));

vi.mock('@google-cloud/firestore', () => {
  // Mock the static WriteResult class
  class MockWriteResult {
    isEqual(other: any): boolean {
      return true;
    }
    get writeTime(): any {
      return { toDate: () => new Date() };
    }
  }

  return {
    Firestore: vi.fn(() => ({
      collection: mockCollection,
    })),
    WriteResult: MockWriteResult,
  };
});
// --- END MOCK ---

describe('Firestore Service (Unit)', () => {
  let db: Firestore;

  beforeEach(() => {
    db = new Firestore();
    vi.clearAllMocks();
    mockDocGet.mockReset();
    mockQueryGet.mockReset();
    mockDocSet.mockReset();
    mockDoc.mockClear();
    mockCollection.mockClear();
  });

  describe('getUserProfile', () => {
    it('should return a URN-based user profile if the document exists', async () => {
      const userId = 'existing-user-id';
      const mockDbData = {
        email: 'found@example.com',
        alias: 'FoundUser',
      };
      // This function creates the old platform-specific URN
      const expectedUser: User = {
        id: URN.parse(`urn:contacts:user:${userId}`),
        email: 'found@example.com',
        alias: 'FoundUser',
      };

      const mockDocSnapshot = {
        exists: true,
        data: () => mockDbData,
        id: userId,
      };
      mockDocGet.mockResolvedValue(mockDocSnapshot);

      const result = await getUserProfile(db, userId);

      expect(mockCollection).toHaveBeenCalledWith('authorized_users');
      expect(mockDoc).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedUser);
      expect(result?.id).toBeInstanceOf(URN);
    });

    it('should return null if the document does not exist', async () => {
      const mockDocSnapshot = { exists: false };
      mockDocGet.mockResolvedValue(mockDocSnapshot);
      const result = await getUserProfile(db, 'non-existent-user-id');
      expect(result).toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('should return user profile data if found by email', async () => {
      const userEmail = 'found@example.com';
      const mockDbData = {
        email: userEmail,
        alias: 'FoundUser',
      };
      const expectedData = {
        id: 'user-id-123',
        email: userEmail,
        alias: 'FoundUser',
      };
      const mockDoc = { id: 'user-id-123', data: () => mockDbData };
      const mockSnapshot = {
        empty: false,
        docs: [mockDoc],
      };
      mockQueryGet.mockResolvedValue(mockSnapshot);

      const result = await findUserByEmail(db, userEmail);

      expect(mockCollection).toHaveBeenCalledWith('authorized_users');
      expect(mockQueryWhere).toHaveBeenCalledWith('email', '==', userEmail);
      expect(result).toEqual(expectedData);
    });

    it('should return null if no user is found by email', async () => {
      const mockSnapshot = { empty: true, docs: [] };
      mockQueryGet.mockResolvedValue(mockSnapshot);
      const result = await findUserByEmail(db, 'notfound@example.com');
      expect(result).toBeNull();
    });
  });

  describe('isEmailBlocked', () => {
    it('should return true if the email document exists in blocked_users', async () => {
      const email = 'blocked@example.com';
      const mockDocSnapshot = { exists: true };
      mockDocGet.mockResolvedValue(mockDocSnapshot);

      const result = await isEmailBlocked(db, email);

      expect(mockCollection).toHaveBeenCalledWith('blocked_users');
      expect(mockDoc).toHaveBeenCalledWith(email);
      expect(result).toBe(true);
    });

    it('should return false if the email document does not exist', async () => {
      const email = 'safe@example.com';
      const mockDocSnapshot = { exists: false };
      mockDocGet.mockResolvedValue(mockDocSnapshot);

      const result = await isEmailBlocked(db, email);

      expect(mockCollection).toHaveBeenCalledWith('blocked_users');
      expect(mockDoc).toHaveBeenCalledWith(email);
      expect(result).toBe(false);
    });
  });

  // --- New test for your new function ---
  describe('addAuthorizedUser', () => {
    it('should save a plain document using the string URN as the key', async () => {
      // 1. Create a federated URN
      const federatedUrn = URN.parse('urn:auth:google:12345');
      const testUser: User = {
        id: federatedUrn,
        email: 'test@example.com',
        alias: 'TestUser',
      };

      // 2. This is the plain object that should be saved
      const expectedDocData = {
        email: 'test@example.com',
        alias: 'TestUser',
      };

      // 3. This is the string key that should be used
      const expectedDocId = 'urn:auth:google:12345';

      // 4. Mock the result of the .set call
      // mockDocSet.mockResolvedValue(new WriteResult());

      // 5. Act
      await addAuthorizedUser(db, testUser);

      // 6. Assert
      expect(mockCollection).toHaveBeenCalledWith('authorized_users');
      expect(mockDoc).toHaveBeenCalledWith(expectedDocId);
      expect(mockDocSet).toHaveBeenCalledWith(expectedDocData);
    });
  });
});
