import type { Profile } from 'passport-google-oauth20';
import type { Firestore } from '@google-cloud/firestore';
import {
  IAuthorizationPolicy,
  AuthorizationDecision,
} from './authorization.policy';

/**
 * A new Firestore function we will add to firestore.ts
 * (This is a forward-declaration, we will implement it next)
 */
import { isEmailBlocked } from '../../firestore';

/**
 * An authorization policy that allows all users *except* those
 * explicitly listed in a 'blocked_users' collection.
 */
export class BlockPolicy implements IAuthorizationPolicy {
  constructor(private db: Firestore) {}

  public async checkAuthorization(
    profile: Profile
  ): Promise<AuthorizationDecision> {
    const email = profile.emails?.[0]?.value;
    const alias = profile.displayName || email || 'Unknown User';

    if (!email) {
      // Don't allow logins without a valid email
      return { isAuthorized: false, alias: '' };
    }

    const isBlocked = await isEmailBlocked(this.db, email);

    if (isBlocked) {
      return { isAuthorized: false, alias: '' };
    }

    // Not blocked, allow them in.
    return {
      isAuthorized: true,
      alias: alias, // Use the alias from their profile
    };
  }
}