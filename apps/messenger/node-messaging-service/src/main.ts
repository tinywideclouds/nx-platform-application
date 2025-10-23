import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './internal/services/logger.js';
import { Firestore } from '@google-cloud/firestore';
import axios from 'axios';

// Import our centralized configuration and services
import { config } from './config.js';
import {
  addContactToAddressBook,
  getUserAddressBook,
} from './internal/firestore.js';

import { authMiddleware } from './internal/auth/auth.middleware.js';

// Import the "public" User type
import type { User } from '@nx-platform-application/platform-types';
import {pinoHttp} from "pino-http";

/**
 * The main startup function for the server.
 * It initializes dependencies and configures the Express application.
 */
async function startServer() {

  try {
    logger.info('[INFO] Initializing node-messaging-service...');

    // --- 2. INITIALIZE DEPENDENCIES ---
    // [REMOVED] All JWKS discovery logic is gone,
    // as it's now handled by the platform-node-auth library.
    const db = new Firestore({ projectId: config.gcpProjectId });
    await db.listCollections(); // Test Firestore connection
    logger.info('[INFO] Firestore connection established.');

    // --- 3. CREATE EXPRESS APP & MIDDLEWARE ---
    const app = express();

    app.use(pinoHttp({ logger }));
    app.use(cors()); // Configure with specific origins in production
    app.use(helmet());
    app.use(express.json());

    // --- 4. DEFINE API ROUTES ---

    // Health check
    app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' });
    });

    // --- Protected Routes ---
    // [CHANGED] authMiddleware is now the clean, imported module
    app.get('/api/contacts', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
      try {
        // The req.user type is now provided by the platform-node-auth library
        const owner = req.user as User;
        const addressBook = await getUserAddressBook(db, owner.id);
        res.status(200).json(addressBook);
      } catch (error) {
        next(error); // Pass to central error handler
      }
    });

    app.post('/api/contacts', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const owner = req.user as User;
        const { email } = req.body;

        if (!email) {
          return res.status(400).json({ error: 'Email is required.' });
        }

        // 1. Ask the identity service for the contact's details.
        const response = await axios.get(
          `${config.identityServiceUrl}/api/users/by-email/${email}`,
          {
            headers: {
              'X-Internal-API-Key': config.internalApiKey,
            },
          }
        );

        const contactToAdd: User = response.data;

        // 2. Add the enriched contact to the owner's address book.
        await addContactToAddressBook(db, owner.id, contactToAdd);
        res.status(201).json(contactToAdd);
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          req.log.info(
            { email: req.body.email, owner: req.user['id'] },
            'Contact add failed: User not found'
          );
          return res
            .status(404)
            .json({ error: 'User with that email not found.' });
        }
        next(error);
      }
    });

    // --- 5. CENTRAL ERROR HANDLING ---
    app.use(
      (err: Error, req: Request, res: Response, _next: NextFunction) => {
        req.log.error(
          { err, stack: err.stack },
          'An unhandled error occurred'
        );
        res.status(500).json({
          error: 'An internal server error occurred.',
          message: err.message,
        });
      }
    );

    // --- 6. SERVER START ---
    app.listen(config.port, () => {
      logger.info(
        `[SUCCESS] node-messaging-service listening on http://localhost:${config.port}`
      );
    });
  } catch (error: any) {
    logger.fatal(
      { err: error, stack: error.stack },
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
    );
    logger.error(
      { err: error },
      '!!!         FATAL: SERVER FAILED TO START            !!!'
    );
    logger.error(
      { err: error },
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
    );
    process.exit(1);
  }
}

// Run the server.
startServer();
