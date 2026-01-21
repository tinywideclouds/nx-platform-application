import { Store } from 'express-session';
import { Firestore, Timestamp } from '@google-cloud/firestore';

interface FirestoreStoreOptions {
  db: Firestore;
  collectionName?: string;
}

interface SessionDoc {
  sess: string; // We store the session JSON stringified
  expireAt: Timestamp; // Native Firestore Timestamp for TTL
}

export class FirestoreStore extends Store {
  private db: Firestore;
  private collectionName: string;

  constructor(options: FirestoreStoreOptions) {
    super();
    this.db = options.db;
    this.collectionName = options.collectionName || 'sessions';
  }

  // Required: Fetch session
  async get(
    sid: string,
    callback: (err: any, session?: any) => void,
  ): Promise<void> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(sid);
      const doc = await docRef.get();

      if (!doc.exists) {
        return callback(null, null);
      }

      const data = doc.data() as SessionDoc;

      if (!data.sess) {
        return callback(null, null);
      }

      const now = Timestamp.now();

      // Manual expiry check (in case Firestore TTL background process hasn't run yet)
      if (data.expireAt && data.expireAt.toMillis() < now.toMillis()) {
        // Optimistically delete it, but don't wait for it
        this.destroy(sid);
        return callback(null, null);
      }

      const result = JSON.parse(data.sess);
      callback(null, result);
    } catch (err) {
      callback(err);
    }
  }

  // Required: Save session
  async set(
    sid: string,
    session: any,
    callback?: (err?: any) => void,
  ): Promise<void> {
    try {
      // Calculate expiration
      let expireAt: Timestamp;

      if (session.cookie && session.cookie.expires) {
        const expireDate = new Date(session.cookie.expires);
        expireAt = Timestamp.fromDate(expireDate);
      } else {
        // Default to 1 day if no cookie expiry is present
        const oneDayLater = Date.now() + 24 * 60 * 60 * 1000;
        expireAt = Timestamp.fromMillis(oneDayLater);
      }

      const data: SessionDoc = {
        sess: JSON.stringify(session),
        expireAt: expireAt,
      };

      await this.db.collection(this.collectionName).doc(sid).set(data);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  // Required: Destroy session
  async destroy(sid: string, callback?: (err?: any) => void): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(sid).delete();
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  // Optional (but recommended): Update expiration on active requests
  async touch(
    sid: string,
    session: any,
    callback?: (err?: any) => void,
  ): Promise<void> {
    // Only update the 'expireAt' field to save write costs on the blob
    try {
      if (session.cookie && session.cookie.expires) {
        const expireDate = new Date(session.cookie.expires);
        const expireAt = Timestamp.fromDate(expireDate);

        await this.db
          .collection(this.collectionName)
          .doc(sid)
          .update({ expireAt });
      }
      if (callback) callback(null);
    } catch (err) {
      // If the document is missing, we can't touch it. Ignore or handle.
      if (callback) callback(null);
    }
  }
}
