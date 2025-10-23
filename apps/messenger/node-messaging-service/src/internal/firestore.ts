import { Firestore } from '@google-cloud/firestore';
// [FIXED] Import the correct "public" User type
import type { User } from '@nx-platform-application/platform-types';

/**
 * Retrieves a user's address book from their subcollection in Firestore.
 *
 * @param db - The shared Firestore database instance.
 * @param userId - The unique document ID of the user whose address book is being requested.
 * @returns A promise that resolves to an array of User objects.
 */
export async function getUserAddressBook(
  db: Firestore,
  userId: string
): Promise<User[]> {
  // Navigate to the user's specific 'address_book' subcollection.
  const snapshot = await db
    .collection('authorized_users')
    .doc(userId)
    .collection('address_book')
    .get();

  if (snapshot.empty) {
    return [];
  }

  // [FIXED] Map the Firestore documents to the User model.
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: data.userId, // This assumes the ID is stored as 'userId'
      email: data.email,
      alias: data.alias,
    };
  });
}

/**
 * Adds a new contact to a user's address book.
 * The document ID will be the contact's own unique user ID.
 *
 * @param db - The shared Firestore database instance.
 * @param ownerId - The ID of the user whose address book is being modified.
 * @param contactToAdd - The complete User object to add.
 * @returns A promise that resolves when the operation is complete.
 */
export async function addContactToAddressBook(
  db: Firestore,
  ownerId: string,
  contactToAdd: User
): Promise<void> {
  // Navigate to the user's address_book subcollection and set the new contact.
  // We use the contact's own ID as the document ID for easy lookups.
  await db
    .collection('authorized_users')
    .doc(ownerId)
    .collection('address_book')
    .doc(contactToAdd.id)
    .set({
      // [FIXED] Store fields from the User type
      alias: contactToAdd.alias,
      email: contactToAdd.email,
      userId: contactToAdd.id, // Explicitly store the ID
    });
}
