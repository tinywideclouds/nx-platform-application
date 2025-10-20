import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Firestore } from '@google-cloud/firestore';
import { getUserProfile } from './firestore.js';
import type { User } from '@nx-platform-application/platform-types';

// --- FIRESTORE MOCK ---
// We mock the entire @google-cloud/firestore library to have full control
// over its behavior without making any real database calls.
const mockDoc = vi.fn();
const mockCollection = vi.fn(() => ({
    where: vi.fn(() => ({
        limit: vi.fn(() => ({
            get: vi.fn(),
        })),
    })),
    doc: mockDoc,
}));

vi.mock('@google-cloud/firestore', () => {
    return {
        Firestore: vi.fn(() => ({
            collection: mockCollection,
        })),
    };
});

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
            mockDoc.mockReturnValue({ get: vi.fn().mockResolvedValue(mockDocSnapshot) });

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
            mockDoc.mockReturnValue({ get: vi.fn().mockResolvedValue(mockDocSnapshot) });

            const result = await getUserProfile(db, userId);

            expect(mockDoc).toHaveBeenCalledWith(userId);
            expect(result).toBeNull();
        });
    });

    // We can also add unit tests for findUserByEmail here
    describe('findUserByEmail', () => {
        it('should return an authenticated user if found by email', async () => {
            // This would follow a similar mocking pattern as getUserProfile
            // ... implementation for findUserByEmail test
        });
    });
});
