// apps/platform/node-identity-service/src/internal/firestore.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Firestore } from '@google-cloud/firestore';
import {
  getUserProfile,
  findUserByEmail,
  isEmailBlocked,
  addAuthorizedUser,
  saveIntegration,
  getIntegration,
  deleteIntegration,
  listIntegrations,
  IntegrationDoc,
} from './firestore.js';
import { User, URN } from '@nx-platform-application/platform-types';

// --- FIRESTORE MOCK ---

// 1. Recursive Mock setup to handle chain: collection -> doc -> collection -> doc
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocDelete = vi.fn();

// The doc object needs to be able to return a collection (sub-collection)
const mockDoc = vi.fn((docId) => ({
  get: mockDocGet,
  set: mockDocSet,
  delete: mockDocDelete,
  collection: mockCollection, // Circular reference to support recursion
  id: docId,
}));

const mockQueryGet = vi.fn();
const mockQueryLimit = vi.fn(() => ({ get: mockQueryGet }));
const mockQueryWhere = vi.fn(() => ({ limit: mockQueryLimit }));
const mockCollectionGet = vi.fn();

// The collection mock needs to handle .where(), .doc(), and .get() (for listing)
function mockCollection(path: string) {
  return {
    where: mockQueryWhere,
    doc: mockDoc,
    get: mockCollectionGet,
  };
}

vi.mock('@google-cloud/firestore', () => {
  return {
    Firestore: vi.fn(() => ({
      collection: mockCollection,
    })),
    WriteResult: class {},
  };
});

describe('Firestore DAL (firestore.ts)', () => {
  let db: Firestore;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Firestore();
  });

  // --- EXISTING TESTS (Preserved) ---

  describe('getUserProfile', () => {
    it('should return null if user does not exist', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await getUserProfile(db, 'user-123');
      expect(result).toBeNull();
    });

    it('should return a User object with URN if found', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        id: 'user-123',
        data: () => ({ email: 'bob@example.com', alias: 'Bob' }),
      });

      const result = await getUserProfile(db, 'user-123');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('bob@example.com');
      expect(result?.alias).toBe('Bob');
      expect(result?.id.toString()).toBe('urn:contacts:user:user-123');
    });
  });

  describe('findUserByEmail', () => {
    it('should return null if query is empty', async () => {
      mockQueryGet.mockResolvedValue({ empty: true });
      const result = await findUserByEmail(db, 'unknown@example.com');
      expect(result).toBeNull();
    });

    it('should return UserProfileData if found', async () => {
      mockQueryGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'doc-id-abc',
            data: () => ({ email: 'test@example.com', alias: 'Tester' }),
          },
        ],
      });

      const result = await findUserByEmail(db, 'test@example.com');
      expect(result).toEqual({
        id: 'doc-id-abc',
        email: 'test@example.com',
        alias: 'Tester',
      });
    });
  });

  describe('isEmailBlocked', () => {
    it('should return true if block document exists', async () => {
      mockDocGet.mockResolvedValue({ exists: true });
      const result = await isEmailBlocked(db, 'bad@actor.com');
      expect(result).toBe(true);
    });

    it('should return false if block document does not exist', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await isEmailBlocked(db, 'good@actor.com');
      expect(result).toBe(false);
    });
  });

  describe('addAuthorizedUser', () => {
    it('should save a document using the string URN as the key', async () => {
      const federatedUrn = URN.parse('urn:auth:google:12345');
      const testUser: User = {
        id: federatedUrn,
        email: 'test@example.com',
        alias: 'TestUser',
      };

      const expectedDocData = {
        email: 'test@example.com',
        alias: 'TestUser',
      };
      const expectedDocId = 'urn:auth:google:12345';

      mockDocSet.mockResolvedValue({});

      await addAuthorizedUser(db, testUser);

      // Verify the chain: db.collection('authorized_users').doc(URN_STRING).set(DATA)
      // Note: In our recursive mock, we can check the calls to the spy functions
      expect(mockDoc).toHaveBeenCalledWith(expectedDocId);
      expect(mockDocSet).toHaveBeenCalledWith(expectedDocData);
    });
  });

  // --- NEW TESTS (Integration Logic) ---

  describe('Integration Helpers', () => {
    const userId = 'urn:auth:google:bob';
    const provider = 'google';
    const mockIntegration: IntegrationDoc = {
      provider: 'google',
      refreshToken: 'secret-ref-token',
      linkedAt: '2025-01-01T00:00:00Z',
      scope: 'drive.file',
      status: 'active',
    };

    describe('saveIntegration', () => {
      it('should save data to the correct sub-collection path', async () => {
        mockDocSet.mockResolvedValue({});

        await saveIntegration(db, userId, provider, {
          refreshToken: 'secret-ref-token',
          linkedAt: '2025-01-01T00:00:00Z',
          scope: 'drive.file',
          status: 'active',
        });

        // 1. Check parent doc access
        expect(mockDoc).toHaveBeenCalledWith(userId);
        // 2. Check sub-collection doc access
        expect(mockDoc).toHaveBeenCalledWith(provider);
        // 3. Check data saved
        expect(mockDocSet).toHaveBeenCalledWith(mockIntegration);
      });
    });

    describe('getIntegration', () => {
      it('should return null if integration does not exist', async () => {
        mockDocGet.mockResolvedValue({ exists: false });
        const result = await getIntegration(db, userId, provider);
        expect(result).toBeNull();
      });

      it('should return IntegrationDoc if found', async () => {
        mockDocGet.mockResolvedValue({
          exists: true,
          data: () => mockIntegration,
        });

        const result = await getIntegration(db, userId, provider);
        expect(result).toEqual(mockIntegration);
      });
    });

    describe('deleteIntegration', () => {
      it('should call delete on the correct document ref', async () => {
        mockDocDelete.mockResolvedValue({});
        await deleteIntegration(db, userId, provider);
        expect(mockDocDelete).toHaveBeenCalled();
      });
    });

    describe('listIntegrations', () => {
      it('should return a map of active integrations', async () => {
        const mockDocs = [
          { id: 'google', data: () => ({}) },
          { id: 'dropbox', data: () => ({}) },
        ];
        mockCollectionGet.mockResolvedValue({
          forEach: (cb: any) => mockDocs.forEach(cb),
        });

        const result = await listIntegrations(db, userId);

        expect(result).toEqual({
          google: true,
          dropbox: true,
        });
      });

      it('should return empty object if no integrations found', async () => {
        mockCollectionGet.mockResolvedValue({
          forEach: (cb: any) => [],
        });

        const result = await listIntegrations(db, userId);

        expect(result).toEqual({});
      });
    });
  });
});
