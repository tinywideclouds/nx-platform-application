// apps/platform/node-identity-service/src/internal/auth/google.strategy.ts

import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Firestore } from '@google-cloud/firestore';
import type {
  Profile,
  GoogleCallbackParameters,
} from 'passport-google-oauth20';
import type { Request } from 'express';
import type { Logger } from 'pino';

// --- 1. Import URN and User ---
import { URN, User } from '@nx-platform-application/platform-types';
import { config } from '../../config.js';
// 2. Import the Policy Interface
import { IAuthorizationPolicy } from './policies/authorization.policy.js';
import { generateToken } from '../services/jwt.service.js';

/**
 * Configures and returns the Passport.js strategy for Google OAuth 2.0.
 *
 * @param db - The shared Firestore database instance.
 * @param logger
 * @param authPolicy - The pluggable authorization policy to use.
 * @returns A configured instance of the GoogleStrategy.
 */
export function configureGoogleStrategy(
  db: Firestore,
  logger: Logger,
  authPolicy: IAuthorizationPolicy // <-- 3. Accept the policy
): GoogleStrategy {
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
    done: (error: any, user?: any, info?: any) => void
  ) => {
    const email = profile.emails?.[0]?.value;
    const idToken = params.id_token;
    const googleId = profile.id; // The provider-specific ID

    if (!email || !idToken || !googleId) {
      const err = new Error('Email, ID token, or Google ID missing from profile.');
      logger.error({ profile }, 'Google profile was missing required fields.');
      return done(err);
    }

    try {
      // 4. AUTHORIZE: Ask the injected policy for a decision
      const decision = await authPolicy.checkAuthorization(profile);

      if (decision.isAuthorized) {
        // 5. CONSTRUCT FEDERATED IDENTITY
        const federatedUrn = URN.parse(`urn:auth:google:${googleId}`);
        
        const user: User = {
          id: federatedUrn,
          email: email,
          alias: decision.alias, // Use alias from the policy decision
        };

        logger.info(
          { userId: user.id.toString(), email, provider: 'google' },
          'User authorized successfully.'
        );
        
        // 6. GENERATE TOKEN & ATTACH
        // This is the object that will be passed to serializeUser
        const internalToken = await generateToken(user, idToken);
        const userWithToken = { ...user, token: internalToken };

        return done(null, userWithToken);
      } else {
        // Policy denied access
        logger.warn(
          { email, provider: 'google' },
          'Unauthorized user login attempt.'
        );
        return done(null, false, { message: 'User is not authorized.' });
      }
    } catch (error: unknown) {
      logger.error(
        { err: error, email },
        'Error during user authorization check.'
      );
      return done(error);
    }
  };

  return new GoogleStrategy(googleStrategyOptions, googleVerifyCallback);
}