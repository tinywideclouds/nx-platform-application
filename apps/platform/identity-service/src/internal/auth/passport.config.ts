import passport from 'passport';
import { Firestore } from '@google-cloud/firestore';

import { getUserProfile } from '../firestore.js';
import { configureGoogleStrategy } from './google.strategy.js';
import { logger } from '../services/logger.service.js';
import type { User } from '@nx-platform-application/platform-types';

/**
 * Configures the entire Passport.js middleware.
 *
 * This function sets up the user serialization and deserialization, which are
 * essential for session management. It also initializes and registers all the
 * different authentication strategies the application will support.
 *
 * @param db - The shared Firestore database instance.
 */
export function configurePassport(db: Firestore): void {
    // Register the Google strategy
  passport.use(configureGoogleStrategy(db, logger));

    // In the future, you would add other strategies here:
    // passport.use(configureMicrosoftStrategy(db));
    // passport.use(configureAppleStrategy(db));

    // Stores the user's unique Firestore ID in the session cookie.
    passport.serializeUser((user, done) => {
        done(null, (user as User).id);
    });

    // Uses the ID from the session cookie to retrieve the full user object
    // from Firestore on subsequent requests.
    passport.deserializeUser(async (id: string, done) => {
        try {
            const userProfile = await getUserProfile(db, id);
            if (userProfile) {
                // Reconstruct the AuthenticatedUser object for req.user
                const sessionUser: User = { ...userProfile, id };
                done(null, sessionUser);
            } else {
                done(new Error('User not found.'));
            }
        } catch (err) {
            done(err);
        }
    });
}
