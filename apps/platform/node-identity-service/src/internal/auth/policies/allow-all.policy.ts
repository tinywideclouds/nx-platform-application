import type { Profile } from 'passport-google-oauth20';
import {
  IAuthorizationPolicy,
  AuthorizationDecision,
} from './authorization.policy';

/**
 * An authorization policy that allows all users to log in.
 * This is the default "open registration" policy.
 */
export class AllowAllPolicy implements IAuthorizationPolicy {
  public async checkAuthorization(
    profile: Profile
  ): Promise<AuthorizationDecision> {
    const alias = profile.displayName || profile.emails?.[0]?.value || 'Unknown User';
    
    return {
      isAuthorized: true,
      alias: alias,
    };
  }
}