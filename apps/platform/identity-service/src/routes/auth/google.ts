import express from 'express';
import passport from 'passport';

const router = express.Router();

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: 'http://localhost:4200/login?error=unauthorized',
}), (_req, res) => {
    res.redirect('http://localhost:4200/login-success');
});

export const googleAuthRoutes = router;