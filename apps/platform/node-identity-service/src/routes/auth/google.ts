import express from 'express';
import passport from 'passport';
import { config } from '../../config.js';

const router = express.Router();

router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: config.googleRedirectUrlFailure, // CHANGED
  }),
  (_req, res) => {
    res.redirect(config.googleRedirectUrlSuccess); // CHANGED
  }
);

export const googleAuthRoutes = router;
