import request from 'supertest';
import express, { Express, NextFunction, Request, Response } from 'express';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIntegrationsRouter } from './integrations.routes.js';
import { User, URN } from '@nx-platform-application/platform-types';

// --- MOCKS ---

// 1. Mock Middleware to simulate authenticated user
const mockUser: User = {
  id: URN.parse('urn:auth:test:user-1'),
  email: 'test@user.com',
  alias: 'Test',
};

vi.mock('../../internal/middleware/auth.middleware.js', () => ({
  ensureAuthenticated: (req: Request, _res: Response, next: NextFunction) => {
    req.user = mockUser;
    next();
  },
}));

// 2. Mock Services
const mockExchange = vi.fn();
const mockRefresh = vi.fn();
const mockRevoke = vi.fn();

vi.mock('../../internal/services/google.service.js', () => ({
  exchangeAuthCode: (...args: any[]) => mockExchange(...args),
  refreshAccessToken: (...args: any[]) => mockRefresh(...args),
  revokeToken: (...args: any[]) => mockRevoke(...args),
}));

// 3. Mock Firestore Helpers
const mockSave = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockList = vi.fn();

vi.mock('../../internal/firestore.js', () => ({
  saveIntegration: (...args: any[]) => mockSave(...args),
  getIntegration: (...args: any[]) => mockGet(...args),
  deleteIntegration: (...args: any[]) => mockDelete(...args),
  listIntegrations: (...args: any[]) => mockList(...args),
}));

// 4. Mock Logger
vi.mock('@nx-platform-application/node-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Integrations Router', () => {
  let app: Express;
  // We pass a dummy object because we mocked the internal firestore functions
  const mockDb = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/integrations', createIntegrationsRouter(mockDb));
    // Error handler mock
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({ error: err.message });
    });
  });

  describe('POST /google/link', () => {
    it('should exchange code and save integration', async () => {
      mockExchange.mockResolvedValue({
        accessToken: 'ac-1',
        refreshToken: 'rf-1',
        expiresIn: 3600,
        scope: 'drive.file',
      });
      mockSave.mockResolvedValue({});

      const res = await request(app)
        .post('/api/integrations/google/link')
        .send({ code: 'valid-code' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('linked');
      expect(mockExchange).toHaveBeenCalledWith('valid-code');
      expect(mockSave).toHaveBeenCalledWith(
        mockDb,
        'urn:auth:test:user-1',
        'google',
        expect.objectContaining({ refreshToken: 'rf-1' }),
      );
    });

    it('should return 400 if code is missing', async () => {
      const res = await request(app)
        .post('/api/integrations/google/link')
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /google/token', () => {
    it('should return fresh token using stored refresh_token', async () => {
      mockGet.mockResolvedValue({ refreshToken: 'stored-rf' });
      mockRefresh.mockResolvedValue({
        accessToken: 'fresh-ac',
        expiresIn: 3600,
      });

      const res = await request(app).get('/api/integrations/google/token');

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBe('fresh-ac');
      expect(mockRefresh).toHaveBeenCalledWith('stored-rf');
    });

    it('should return 401 and auto-delete if refresh token is invalid', async () => {
      mockGet.mockResolvedValue({ refreshToken: 'bad-rf' });
      mockRefresh.mockRejectedValue(new Error('REFRESH_TOKEN_INVALID'));

      const res = await request(app).get('/api/integrations/google/token');

      expect(res.status).toBe(401);
      expect(mockDelete).toHaveBeenCalledWith(
        mockDb,
        'urn:auth:test:user-1',
        'google',
      );
    });

    it('should return 404 if no integration exists', async () => {
      mockGet.mockResolvedValue(null);
      const res = await request(app).get('/api/integrations/google/token');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /google', () => {
    it('should revoke and delete', async () => {
      mockGet.mockResolvedValue({ refreshToken: 'rf-to-kill' });
      mockRevoke.mockResolvedValue({});
      mockDelete.mockResolvedValue({});

      const res = await request(app).delete('/api/integrations/google');

      expect(res.status).toBe(200);
      expect(mockRevoke).toHaveBeenCalledWith('rf-to-kill');
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
