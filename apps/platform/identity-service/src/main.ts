import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import { Firestore } from '@google-cloud/firestore';
import { FirestoreStore } from '@google-cloud/connect-firestore';

// Import our centralized configuration and services
import { config } from './config.js';
import { configurePassport } from './internal/auth/passport.config.js';
import { createMainRouter } from './routes/index.js';
import { generateJwks } from './routes/jwt/jwks.js'; // Import the JWKS generator
import { validateJwtConfiguration } from './internal/services/jwt-validator.service.js';

async function startServer() {
    try {
        console.log('[INFO] Initializing node-identity-service...');

        if (!config.gcpProjectId) {
            throw new Error("GCP_PROJECT_ID is not defined in the configuration.");
        }

        // --- DATABASE INITIALIZATION ---
        const db = new Firestore({ projectId: config.gcpProjectId });
        await db.listCollections();
        console.log(`[SUCCESS] Firestore connection verified for project: "${config.gcpProjectId}".`);

        // --- CRYPTOGRAPHIC KEY INITIALIZATION ---
        // This is a critical startup step. We must generate the keys before starting the server.
        await validateJwtConfiguration(); // <-- 2. INTEGRATE VALIDATION
        await generateJwks();
        console.log('[SUCCESS] JWKS cryptographic keys generated and cached.');

        const app = express();

        // --- CORE MIDDLEWARE ---
        app.use(cors({
            origin: 'http://localhost:4200',
            credentials: true,
        }));

        const firestoreSessionStore = new FirestoreStore({
            dataset: db,
            kind: 'express-sessions',
        });

        app.use(session({
            store: firestoreSessionStore,
            secret: config.sessionSecret,
            resave: false,
            saveUninitialized: false,
            cookie: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
        }));

        // --- PASSPORT MIDDLEWARE & CONFIGURATION ---
        app.use(passport.initialize());
        app.use(passport.session());
        configurePassport(db);

        // --- ROUTE CONFIGURATION ---
        const mainRouter = createMainRouter(db);
        app.use('/', mainRouter);

        // --- SERVER START ---
        app.listen(config.port, () => {
            console.log(`[SUCCESS] node-identity-service listening on http://localhost:${config.port}`);
        });

    } catch (error: any) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!!         FATAL: SERVER FAILED TO START            !!!");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("\nERROR:", error.message);
        if (error.cause) {
            console.error("  -> CAUSE:", error.cause);
        }
        process.exit(1);
    }
}

startServer();
