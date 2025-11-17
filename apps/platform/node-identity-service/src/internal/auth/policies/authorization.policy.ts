import type { Profile } from 'passport-google-oauth20';
import type { Firestore } from '@google-cloud/firestore';

/**
 * The decision returned by an authorization policy.
 */
export interface AuthorizationDecision {
  /** Is the user allowed to log in? */
  isAuthorized: boolean;
  
  /** * The alias to use for the user.
   * Can be from the DB (MembershipPolicy) or the profile (AllowAllPolicy).
   */
  alias: string;
}

/**
 * Defines the interface for a pluggable authorization policy.
 * This allows the service to switch between "Allow All", "Membership",
 * or "Block List" strategies.
 */
export interface IAuthorizationPolicy {
  /**
   * Checks if a user, identified by their external provider profile,
   * is authorized to access the system.
   * @param profile The user's profile from the external provider (e.g., Google).
   * @returns A promise that resolves to an AuthorizationDecision.
   */
  checkAuthorization(profile: Profile): Promise<AuthorizationDecision>;
}

/**
 * A factory type for creating a policy.
 * This allows us to pass the Firestore DB to policies that need it.
 */
export type AuthorizationPolicyFactory = (db: Firestore) => IAuthorizationPolicy;