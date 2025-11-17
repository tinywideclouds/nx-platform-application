import type { Profile } from 'passport-google-oauth20';
import type { Firestore } from '@google-cloud/firestore';
import {
  IAuthorizationPolicy,
  AuthorizationDecision,
} from './authorization.policy';
import { findUserByEmail } from '../../firestore.js';

/**
 * An authorization policy that only allows users who exist
 * in the 'authorized_users' collection.
 */
export class MembershipPolicy implements IAuthorizationPolicy {
  constructor(private db: Firestore) {}

  public async checkAuthorization(
    profile: Profile
  ): Promise<AuthorizationDecision> {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      return { isAuthorized: false, alias: '' };
    }

    // findUserByEmail will now *only* be used for this check.
    const user = await findUserByEmail(this.db, email);

    if (user) {
      return {
        isAuthorized: true,
        alias: user.alias, // Use the alias from the database
      };
    }

    return { isAuthorized: false, alias: '' };
  }
}