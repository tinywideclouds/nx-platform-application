import { Router } from 'express';

const router = Router();

router.get('/health-check', (_req, res) => {
    res.status(200).json({ status: 'ok', message: 'Routing is working.' });
});

export const healthCheckRouter = router;