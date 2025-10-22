import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Firestore } from '@google-cloud/firestore';
import type { Profile, GoogleCallbackParameters } from 'passport-google-oauth20';
import type { Request } from 'express';
import type { Logger } from 'pino';

import { config } from '../../config.js';
import { findUserByEmail } from '../firestore.js';
import { generateToken } from '../services/jwt.service.js';

/**
 * Configures and returns the Passport.js strategy for Google OAuth 2.0.
 *
 * @param db - The shared Firestore database instance.
 * @param logger
 * @returns A configured instance of the GoogleStrategy.
 */
export function configureGoogleStrategy(db: Firestore, logger: Logger): GoogleStrategy {
  // [FIX] Add a type guard.
  // We know from config.ts that these are validated at startup, but this
  // check satisfies the linter and narrows the type from 'string | undefined' to 'string'.
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error(
      'FATAL: Google OAuth configuration (CLIENT_ID or CLIENT_SECRET) is missing.'
    );
  }

  const googleStrategyOptions = {
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    callbackURL: config.googleAuthCallback,
    passReqToCallback: true,
  } as const;

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
      const err = new Error('Email or ID token missing from Google profile.');
      logger.error({ profile }, 'Google profile was missing required fields.');
      return done(err);
    }
    try {
      // NOTE: This `user` object will correctly be the shared `User` type
      // once we refactor `firestore.ts`. No change is needed here.
      const user = await findUserByEmail(db, email);
      if (user) {
        // NOTE: `generateToken` now correctly expects the shared `User` type,
        // which is what we will receive from `findUserByEmail`.
        logger.info(
          { userId: user.id, email, provider: 'google' },
          'User authorized successfully.'
        );
        const internalToken = generateToken(user, idToken);
        const userWithToken = { ...user, token: internalToken };
        return done(null, userWithToken);
      } else {
        // Log unauthorized user attempt
        logger.warn(
          { email, provider: 'google' },
          'Unauthorized user login attempt.'
        );
        return done(null, false, { message: 'User is not authorized.' });
      }
    } catch (error: unknown) {
      logger.error({ err: error, email }, 'Error during user authorization check.');
      return done(error);
    }
  };

  return new GoogleStrategy(googleStrategyOptions, googleVerifyCallback);
}
