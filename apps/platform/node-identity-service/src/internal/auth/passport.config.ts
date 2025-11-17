// apps/platform/node-identity-service/src/internal/auth/passport.config.ts

import passport from 'passport';
import { Firestore } from '@google-cloud/firestore';
// 1. Import URN and User
import { URN, User } from '@nx-platform-application/platform-types';
import { configureGoogleStrategy } from './google.strategy.js';
import { logger } from '@nx-platform-application/node-logger';
// 2. Import the policy interface
import { IAuthorizationPolicy } from './policies/authorization.policy.js';
// getUserProfile is no longer used by passport

/**
 * Configures the entire Passport.js middleware.
 *
 * @param db - The shared Firestore database instance.
 * @param authPolicy - The selected authorization policy.
 */
// 3. Update function signature
export function configurePassport(
  db: Firestore,
  authPolicy: IAuthorizationPolicy
): void {
  // 4. Pass the policy to the strategy
  passport.use(configureGoogleStrategy(db, logger, authPolicy));

  // Stores a serializable object in the session.
  passport.serializeUser((user, done) => {
    const u = user as User;
    const token = (user as any).token; // Get token from the strategy
    
    const sessionData = {
      id: u.id.toString(), // Store the stringified URN
      email: u.email,
      alias: u.alias,
      token: token,
    };
    done(null, sessionData);
  });

  // Reconstructs the User object (with URN) from the session data.
  // This is now synchronous and has no DB dependency.
  passport.deserializeUser((sessionData: any, done) => {
    try {
      // 5. Reconstruct the User from the session blob
      const user: User = {
        id: URN.parse(sessionData.id), // Re-parse the string URN
        email: sessionData.email,
        alias: sessionData.alias,
      };
      // Re-attach the token
      (user as any).token = sessionData.token;
      
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}