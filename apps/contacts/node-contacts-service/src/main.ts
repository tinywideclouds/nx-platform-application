import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@nx-platform-application/node-logger';
import { Firestore } from '@google-cloud/firestore';
import axios from 'axios';
import { pinoHttp } from "pino-http";

// Import our centralized configuration and services
import { config } from './config.js'; // Will be created in Task 3
import {
  addContactToAddressBook,
  getUserAddressBook,
} from './internal/firestore.js'; // Corrected path

import { authMiddleware } from './internal/auth/auth.middleware.js'; // Will be created in Task 3

// Import the "public" User type
import type { User } from '@nx-platform-application/platform-types';

/**
 * The main startup function for the server.
 * It initializes dependencies and configures the Express application.
 */
async function startServer() {

  try {
    // [CHANGED] Log message updated for the new service
    logger.info('[INFO] Initializing node-contacts-service...');

    // --- 2. INITIALIZE DEPENDENCIES ---
    const db = new Firestore({ projectId: config.gcpProjectId });
    await db.listCollections();
    logger.info('[INFO] Firestore connection established.');

    // --- 3. CREATE EXPRESS APP & MIDDLEWARE ---
    const app = express();

    app.use(pinoHttp({ logger }));
    app.use(cors());
    app.use(helmet());
    app.use(express.json());

    // --- 4. DEFINE API ROUTES ---

    // Health check
    app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' });
    });

    // --- Protected Routes ---
    // [MOVED] All /api/contacts routes are now in this service
    app.get('/api/contacts', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const owner = req.user as User;
        const addressBook = await getUserAddressBook(db, owner.id);
        res.status(200).json(addressBook);
      } catch (error) {
        next(error);
      }
    });

    app.post('/api/contacts', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const owner = req.user as User;
        const { email } = req.body;

        if (!email) {
          return res.status(400).json({ error: 'Email is required.' });
        }

        const response = await axios.get(
          `${config.identityServiceUrl}/api/users/by-email/${email}`,
          {
            headers: {
              'X-Internal-API-Key': config.internalApiKey,
            },
          }
        );

        const contactToAdd: User = response.data;

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
        // [CHANGED] Log message updated
        `[SUCCESS] node-contacts-service listening on http://localhost:${config.port}`
      );
    });
  } catch (error: any) {
    // ... (Fatal error handling remains the same) ...
  }
}

// Run the server.
startServer();
