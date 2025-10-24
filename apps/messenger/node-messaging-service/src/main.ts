// apps/messenger/node-messaging-service/src/main.ts

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { pinoHttp } from "pino-http";
import cors from 'cors';
import helmet from 'helmet';
import { Firestore } from '@google-cloud/firestore';

import { logger } from '@nx-platform-application/node-logger';
// Import our centralized configuration and services
import { config } from './config.js';

/**
 * The main startup function for the server.
 * It initializes dependencies and configures the Express application.
 */
async function startServer() {

  try {
    logger.info('[INFO] Initializing node-messaging-service...');

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
    // [REMOVED] All /api/contacts routes are gone.
    // TODO: Add messaging-specific routes here (e.g., /api/messages)

    // --- 5. CENTRAL ERROR HANDLING ---
    app.use(
      (err: Error, req: Request, res: Response, _next: NextFunction) => {
        // ... (Error handling remains the same) ...
      }
    );

    // --- 6. SERVER START ---
    app.listen(config.port, () => {
      logger.info(
        `[SUCCESS] node-messaging-service listening on http://localhost:${config.port}`
      );
    });
  } catch (error: any) {
    // ... (Fatal error handling remains the same) ...
  }
}

// Run the server.
startServer();
