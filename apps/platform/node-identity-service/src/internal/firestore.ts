// apps/platform/node-identity-service/src/internal/firestore.ts

import { Firestore, WriteResult } from '@google-cloud/firestore';
import { User, URN } from '@nx-platform-application/platform-types';

// --- EXISTING TYPES ---

interface AuthorizedUserDoc {
  email: string;
  alias: string;
}

export function UserToUserDoc(u: User): AuthorizedUserDoc {
  return {
    email: u.email,
    alias: u.alias,
  };
}

interface UserProfileData {
  id: string;
  email: string;
  alias: string;
}

// --- NEW TYPES (Integration Isolation) ---

export type IntegrationProvider = 'google' | 'dropbox' | 'apple';

export interface IntegrationDoc {
  provider: IntegrationProvider;
  refreshToken: string; // Encrypted/Secure Token
  linkedAt: string; // ISO Date
  scope: string;
  status: 'active' | 'revoked';
}

// --- CORE FUNCTIONS ---

export async function findUserByEmail(
  db: Firestore,
  email: string,
): Promise<UserProfileData | null> {
  const usersRef = db.collection('authorized_users');
  const q = usersRef.where('email', '==', email).limit(1);
  const snapshot = await q.get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data() as AuthorizedUserDoc;

  return {
    id: doc.id,
    email: data.email,
    alias: data.alias,
  };
}

export async function isEmailBlocked(
  db: Firestore,
  email: string,
): Promise<boolean> {
  const docRef = db.collection('blocked_users').doc(email);
  const doc = await docRef.get();
  return doc.exists;
}

export async function getUserProfile(
  db: Firestore,
  userId: string,
): Promise<User | null> {
  const userDoc = await db.collection('authorized_users').doc(userId).get();
  if (!userDoc.exists) {
    return null;
  }
  const userData = userDoc.data() as AuthorizedUserDoc;
  if (!userData) return null;

  return {
    id: URN.parse(`urn:contacts:user:${userDoc.id}`),
    email: userData.email,
    alias: userData.alias,
  };
}

/**
 * Adds or updates an authorized user in the database.
 * Uses the User's URN string (e.g., "urn:auth:google:123") as the document key.
 */
export async function addAuthorizedUser(
  db: Firestore,
  user: User,
): Promise<WriteResult> {
  const docRef = db.collection('authorized_users').doc(user.id.toString());
  return docRef.set(UserToUserDoc(user));
}

// --- NEW INTEGRATION FUNCTIONS (Sub-Collection) ---

/**
 * Saves a secure integration record for a specific user.
 * Stores data in: authorized_users/{userId}/integrations/{provider}
 */
export async function saveIntegration(
  db: Firestore,
  userId: string,
  provider: IntegrationProvider,
  data: Omit<IntegrationDoc, 'provider'>,
): Promise<WriteResult> {
  const docRef = db
    .collection('authorized_users')
    .doc(userId)
    .collection('integrations')
    .doc(provider);

  return docRef.set({
    provider,
    ...data,
  });
}

/**
 * Retrieves an integration record.
 * Used to get the refreshToken for server-side operations.
 */
export async function getIntegration(
  db: Firestore,
  userId: string,
  provider: IntegrationProvider,
): Promise<IntegrationDoc | null> {
  const docRef = db
    .collection('authorized_users')
    .doc(userId)
    .collection('integrations')
    .doc(provider);

  const doc = await docRef.get();
  if (!doc.exists) return null;

  return doc.data() as IntegrationDoc;
}

/**
 * Deletes an integration record.
 * Used during disconnect/unlink.
 */
export async function deleteIntegration(
  db: Firestore,
  userId: string,
  provider: IntegrationProvider,
): Promise<WriteResult> {
  const docRef = db
    .collection('authorized_users')
    .doc(userId)
    .collection('integrations')
    .doc(provider);

  return docRef.delete();
}

/**
 * Lists all active integrations for a user.
 * Used for the "Status" check without exposing secrets.
 */
export async function listIntegrations(
  db: Firestore,
  userId: string,
): Promise<Record<string, boolean>> {
  const colRef = db
    .collection('authorized_users')
    .doc(userId)
    .collection('integrations');

  const snapshot = await colRef.get();
  const result: Record<string, boolean> = {};

  snapshot.forEach((doc) => {
    // We simply return true/false map, e.g., { google: true }
    result[doc.id] = true;
  });

  return result;
}
