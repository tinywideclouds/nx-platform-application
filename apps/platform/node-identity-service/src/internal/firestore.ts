import { Firestore } from '@google-cloud/firestore';
import type { User } from '@nx-platform-application/platform-types';

/**
 * Finds an authorized user by their email address.
 *
 * This function is the primary lookup used by the Passport.js Google strategy
 * to verify if a user who has successfully logged in with Google is
 * authorized to use the application.
 *
 * @param db - The shared Firestore database instance.
 * @param email - The email address to search for in the 'authorized_users' collection.
 * @returns A promise that resolves to the full AuthenticatedUser object if found,
 * or null if no matching user is found.
 */
export async function findUserByEmail(
  db: Firestore,
  email: string
): Promise<User | null> {
  const usersRef = db.collection('authorized_users');
  const q = usersRef.where('email', '==', email).limit(1);
  const snapshot = await q.get();

  if (snapshot.empty) {
    return null;
  }
  const userDoc = snapshot.docs[0];
  if (userDoc == undefined) return null;
  const userData = userDoc.data() as User;

  // Construct the AuthenticatedUser object, which includes the document ID.
  return {
    id: userDoc.id,
    email: userData.email,
    alias: userData.alias,
  };
}

/**
 * Fetches a user's profile by their Firestore document ID.
 *
 * This function is used by Passport.js's deserializeUser function to retrieve
 * the full user profile from Firestore using the ID stored in the session.
 *
 * @param db - The shared Firestore database instance.
 * @param userId - The unique document ID of the user in the 'authorized_users' collection.
 * @returns A promise that resolves to the user's profile data, or null if the
 * document does not exist.
 */
export async function getUserProfile(
  db: Firestore,
  userId: string
): Promise<User | null> {
  const userDoc = await db.collection('authorized_users').doc(userId).get();
  if (!userDoc.exists) {
    return null;
  }
  return userDoc.data() as User;
}
