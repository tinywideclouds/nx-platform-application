import express from 'express';
import { findUserByEmail } from '../../internal/firestore.js';
import { internalAuthMiddleware } from '../../internal/auth/network.middleware.js';
import { generateToken } from '../../internal/services/jwt.service.js';
import { Firestore } from '@google-cloud/firestore';

interface Contact {
    id: string
    alias: string
    email: string
}

// This middleware will be passed in from the main server file
const ensureAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.isAuthenticated()) { return next(); }
    res.status(401).json({ error: 'Not authenticated' });
};

// We create a function that accepts the db instance (Dependency Injection)
export const createUserApiRoutes = (db: Firestore) => {
    const router = express.Router();

    router.get('/api/auth/status', (req, res) => {
        if (req.isAuthenticated()) {
            const user = req.user as Contact;
            const token = generateToken(user, "session-authenticated-token");
            res.json({ authenticated: true, user: { ...user, token } });
        } else {
            res.json({ authenticated: false, user: null });
        }
    });

    router.get('/api/auth/refresh-token', ensureAuthenticated, (req, res) => {
        const user = req.user as Contact;
        const newInternalToken = generateToken(user, "re-issued-token-placeholder");
        res.json({ token: newInternalToken });
    });

    router.post('/api/auth/logout', (req, res, next) => {
        req.logout((err) => {
            if (err) { return next(err); }
            req.session.destroy(() => {
                res.clearCookie('connect.sid');
                res.status(200).send();
            });
        });
    });

    router.get('/api/users/by-email/:email', internalAuthMiddleware, async (req, res) => {
        const { email } = req.params;
        if (email == undefined) {
            res.status(400).json({error: 'malformed request no email'})
            return
        }
        try {
            const user = await findUserByEmail(db, email);
            if (user) {
                res.json({ id: user.id, alias: user.alias, email: user.email });
            } else {
                res.status(404).json({ error: 'User not found.' });
            }
        } catch (error) {
            console.error(`[ERROR] User lookup failed for email ${email}:`, error);
            res.status(500).json({ error: 'Internal server error.' });
        }
    });

    return router;
};
