import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Firestore } from '@google-cloud/firestore';
import type { Profile, GoogleCallbackParameters } from 'passport-google-oauth20';
import type { Request } from 'express';

import { config } from '../../config.js';
import { findUserByEmail } from '../firestore.js';
import { generateToken } from '../services/jwt.service.js';

/**
 * Configures and returns the Passport.js strategy for Google OAuth 2.0.
 *
 * @param db - The shared Firestore database instance.
 * @returns A configured instance of the GoogleStrategy.
 */
export function configureGoogleStrategy(db: Firestore): GoogleStrategy {
  // [FIX] Add a type guard.
  // We know from config.ts that these are validated at startup, but this
  // check satisfies the linter and narrows the type from 'string | undefined' to 'string'.
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error(
      'FATAL: Google OAuth configuration (CLIENT_ID or CLIENT_SECRET) is missing.'
    );
  }

  const googleStrategyOptions = {
    // [REMOVED] The '!' is no longer needed
    clientID: config.googleClientId,
    // [REMOVED] The '!' is no longer needed
    clientSecret: config.googleClientSecret,
    callbackURL: '/auth/google/callback',
    passReqToCallback: true,
  } as const;

  // THE FIX:
  // We remove the explicit `: VerifyCallback` type annotation.
  // The library's type definition is too strict and doesn't account for modern
  // async/await functions (which return a Promise). By removing the explicit
  // type, we allow TypeScript to infer the correct signature, which is
  // compatible with the GoogleStrategy constructor at runtime.
  const googleVerifyCallback = async (
    req: Request,
    accessToken: string,
    refreshToken: string,
    params: GoogleCallbackParameters,
    profile: Profile,
    // We must use 'any' to match the type definition from passport.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    done: (error: any, user?: any, info?: any) => void
  ) => {
    const email = profile.emails?.[0]?.value;
    const idToken = params.id_token;

    // A robust check to ensure the id_token exists.
    if (!email || !idToken) {
      return done(new Error('Email or ID token missing from Google profile.'));
    }
    try {
      // NOTE: This `user` object will correctly be the shared `User` type
      // once we refactor `firestore.ts`. No change is needed here.
      const user = await findUserByEmail(db, email);
      if (user) {
        // NOTE: `generateToken` now correctly expects the shared `User` type,
        // which is what we will receive from `findUserByEmail`.
        const internalToken = generateToken(user, idToken);
        const userWithToken = { ...user, token: internalToken };
        return done(null, userWithToken);
      } else {
        return done(null, false, { message: 'User is not authorized.' });
      }
    } catch (error) {
      return done(error);
    }
  };

  return new GoogleStrategy(googleStrategyOptions, googleVerifyCallback);
}
