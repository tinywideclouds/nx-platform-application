// apps/platform/node-identity-service/src/internal/firestore.ts

import { Firestore, WriteResult } from '@google-cloud/firestore';
// 1. Import URN
import { User, URN } from '@nx-platform-application/platform-types';

// This is the shape of the data in the 'authorized_users' collection
interface AuthorizedUserDoc {
  email: string;
  alias: string;
}

export function UserToUserDoc(u: User): AuthorizedUserDoc {
  return {
    email: u.email,
    alias: u.alias
  }
}

// 2. This is the object our internal services will return from lookups
interface UserProfileData {
  id: string; // The Firestore Document ID
  email: string;
  alias: string;
}

/**
 * [MODIFIED] Finds an authorized user by their email address.
 *
 * This function is used by the MembershipPolicy and the GET /users/by-email API.
 * It returns the raw user data, not a "User" object.
 *
 * @returns A promise that resolves to the user's profile data if found, or null.
 */
export async function findUserByEmail(
  db: Firestore,
  email: string
): Promise<UserProfileData | null> {
  const usersRef = db.collection('authorized_users');
  const q = usersRef.where('email', '==', email).limit(1);
  const snapshot = await q.get();

  if (snapshot.empty) {
    return null;
  }
  const userDoc = snapshot.docs[0];
  if (userDoc == undefined) return null;
  const userData = userDoc.data() as AuthorizedUserDoc;

  // 3. FIX: Return the full profile data
  return {
    id: userDoc.id,
    email: userData.email,
    alias: userData.alias,
  };
}

/**
 * [NEW] Checks if a user's email is in the 'blocked_users' collection.
 */
export async function isEmailBlocked(
  db: Firestore,
  email: string
): Promise<boolean> {
  const docRef = db.collection('blocked_users').doc(email);
  const doc = await docRef.get();
  return doc.exists;
}

/**
 * [MODIFIED] Fetches a user's profile by their Firestore document ID.
 *
 * This function is no longer used by the auth flow (passport)
 * but is kept for internal API routes.
 *
 * @param userId - The unique document ID (string) of the user.
 * @returns A promise that resolves to the URN-based User object.
 */
export async function getUserProfile(
  db: Firestore,
  userId: string // The ID from Firestore is a string
): Promise<User | null> {
  const userDoc = await db.collection('authorized_users').doc(userId).get();
  if (!userDoc.exists) {
    return null;
  }
  const userData = userDoc.data() as AuthorizedUserDoc;
  if (!userData) return null;

  // 4. This function MUST return the URN-based object
  // to match the 'User' type, as it's not part of the auth flow.
  // It is creating a 'urn:sm:user' URN.
  return {
    id: URN.parse(`urn:sm:user:${userDoc.id}`), // <-- This is the platform ID
    email: userData.email,
    alias: userData.alias,
  };
}

export async function addAuthorizedUser(
  db: Firestore,
  user: User 
): Promise<WriteResult | null> {

  const key = user.id.toString();
  const doc = UserToUserDoc(user);

  const r = await db.collection('authorized_users').doc(key).set(doc);
  return r
}