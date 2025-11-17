// apps/platform/node-identity-service/src/internal/firestore.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Firestore } from '@google-cloud/firestore';
import {
  getUserProfile,
  findUserByEmail,
  isEmailBlocked,
} from './firestore.js';
import { User, URN } from '@nx-platform-application/platform-types';

// --- FIRESTORE MOCK ---
const mockDocGet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockDocGet }));

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
    vi.clearAllMocks();
    mockDocGet.mockReset();
    mockQueryGet.mockReset();
  });

  // --- 1. FIX: getUserProfile returns a URN-based User object ---
  describe('getUserProfile', () => {
    it('should return a URN-based user profile if the document exists', async () => {
      const userId = 'existing-user-id';
      const mockDbData = {
        email: 'found@example.com',
        alias: 'FoundUser',
      };
      const expectedUser: User = {
        id: URN.parse(`urn:sm:user:${userId}`),
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

  // --- 2. FIX: findUserByEmail returns UserProfileData ---
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

  // --- 3. isEmailBlocked tests (Unchanged) ---
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
});