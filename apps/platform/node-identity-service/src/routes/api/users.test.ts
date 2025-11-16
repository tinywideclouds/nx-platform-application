import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createUserApiRoutes } from './users.js';
import { findUserByEmail } from '../../internal/firestore.js';
import { generateToken } from '../../internal/services/jwt.service.js';
import type { User } from '@nx-platform-application/platform-types';
import { logger } from '@nx-platform-application/node-logger';

// --- Mocks ---

// Mock all imported middlewares to simply pass through
vi.mock('../../internal/auth/network.middleware.js', () => ({
  internalAuthMiddleware: (req: Request, res: Response, next: NextFunction) => next(),
}));
vi.mock('../../internal/middleware/auth.middleware.js', () => ({
  ensureAuthenticated: (req: Request, res: Response, next: NextFunction) => next(),
}));

// Mock services and DB functions
vi.mock('../../internal/firestore.js');
vi.mock('../../internal/services/jwt.service.js');

// Mock logger
vi.mock('@nx-platform-application/node-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Firestore DB object
const mockDb = {} as any; // The service functions are mocked, so this is safe

// --- End Mocks ---

// --- Test State ---
// This object will control the state of our mock session middleware
let mockAuthState: {
  authenticated: boolean;
  user: User | null;
  logoutError: Error | null;
} = {
  authenticated: false,
  user: null,
  logoutError: null,
};

// Mock functions to spy on session calls
const mockLogout = vi.fn((cb: (err?: Error) => void) => {
  cb(mockAuthState.logoutError);
});
const mockSessionDestroy = vi.fn((cb: () => void) => {
  cb();
});

// A mock user for testing
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  alias: 'TestUser',
};
// --- End Test State ---


describe('User API Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // !! CRITICAL !!
    // Add mock session/passport middleware. This adds the
    // req.isAuthenticated, req.user, req.logout, and req.session
    // properties that the route handlers depend on.
    app.use((req: Request, res: Response, next: NextFunction) => {
      req.isAuthenticated = () => mockAuthState.authenticated;
      req.user = mockAuthState.user;
      req.logout = mockLogout;
      req.session = {
        destroy: mockSessionDestroy,
      } as any;
      next();
    });

    // Mount the routes to be tested
    app.use('/api', createUserApiRoutes(mockDb));

    // Reset all mocks and state
    vi.clearAllMocks();
    mockAuthState = {
      authenticated: false,
      user: null,
      logoutError: null,
    };
  });

  describe('GET /api/auth/status', () => {
    it('should return 200 with authenticated state and user token if authenticated', async () => {
      // ARRANGE
      mockAuthState.authenticated = true;
      mockAuthState.user = mockUser;
      vi.mocked(generateToken).mockReturnValue('mock.session.token');

      // ACT
      const response = await request(app).get('/api/auth/status');

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        authenticated: true,
        user: mockUser,
        token: 'mock.session.token',
      });
      expect(generateToken).toHaveBeenCalledWith(
        mockUser,
        'session-authenticated-token'
      );
    });

    it('should return 200 with unauthenticated state if not authenticated', async () => {
      // ARRANGE
      mockAuthState.authenticated = false;

      // ACT
      const response = await request(app).get('/api/auth/status');

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        authenticated: false,
        user: null,
      });
      expect(generateToken).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/refresh-token', () => {
    it('should return 200 and a new token if user is present (from ensureAuthenticated)', async () => {
      // ARRANGE
      // We mock ensureAuthenticated to pass, so we just need to ensure
      // req.user is populated by our test middleware.
      mockAuthState.user = mockUser;
      vi.mocked(generateToken).mockReturnValue('new.refreshed.token');

      // ACT
      const response = await request(app).get('/api/auth/refresh-token');

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ token: 'new.refreshed.token' });
      expect(generateToken).toHaveBeenCalledWith(
        mockUser,
        're-issued-token-placeholder'
      );
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 200 and call logout/destroy', async () => {
      // ARRANGE
      // (No specific arrangement needed, default state is fine)

      // ACT
      const response = await request(app).post('/api/auth/logout');

      // ASSERT
      expect(response.status).toBe(200);
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockSessionDestroy).toHaveBeenCalledTimes(1);
      // Check that the cookie was cleared
      expect(response.headers['set-cookie']).toEqual([
        'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      ]);
    });

    it('should return 500 if req.logout fails', async () => {
      // ARRANGE
      mockAuthState.logoutError = new Error('Logout failed');
      // A default error handler is needed to send a 500
      app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        res.status(500).json({ error: err.message });
      });

      // ACT
      const response = await request(app).post('/api/auth/logout');

      // ASSERT
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Logout failed' });
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockSessionDestroy).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/users/by-email/:email', () => {
    it('should return 200 and user data if user is found', async () => {
      // ARRANGE
      vi.mocked(findUserByEmail).mockResolvedValue(mockUser);

      // ACT
      const response = await request(app)
        .get('/api/users/by-email/test@example.com');

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'user-123',
        alias: 'TestUser',
        email: 'test@example.com',
      });
      expect(findUserByEmail).toHaveBeenCalledWith(mockDb, 'test@example.com');
    });

    it('should return 404 if user is not found', async () => {
      // ARRANGE
      vi.mocked(findUserByEmail).mockResolvedValue(null);

      // ACT
      const response = await request(app)
        .get('/api/users/by-email/notfound@example.com');

      // ASSERT
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found.' });
    });

    it('should return 500 and log error if database throws', async () => {
      // ARRANGE
      const dbError = new Error('Database failure');
      vi.mocked(findUserByEmail).mockRejectedValue(dbError);
      app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        res.status(500).json({ error: 'Internal Server Error' });
      });

      // ACT
      const response = await request(app)
        .get('/api/users/by-email/error@example.com');

      // ASSERT
      expect(response.status).toBe(500);
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        { err: dbError, email: 'error@example.com' },
        'User lookup by email failed'
      );
    });
  });
});
