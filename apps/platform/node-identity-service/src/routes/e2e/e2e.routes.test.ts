import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { e2eRoutes } from './e2e.routes.js';
// [FIXED] Import the *actual* service so we can mock it
import { generateToken } from '../../internal/services/jwt.service.js';

// --- Mocks ---

// Mock the auth middleware
vi.mock('../../internal/middleware/e2e.middleware.js', () => ({
  e2eAuthMiddleware: (req: Request, res: Response, next: NextFunction) => {
    next();
  },
}));

// [FIXED] Tell Vitest to mock the jwt.service.js module
vi.mock('../../internal/services/jwt.service.js');

// Mock the logger
vi.mock('@nx-platform-application/node-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// --- End Mocks ---

describe('E2E Routes (/e2e/generate-test-token)', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use('/api', e2eRoutes);
    vi.clearAllMocks();
  });

  it('should return 200 and a token for a valid request', async () => {
    // ARRANGE
    const mockToken = 'mock.test.token';
    const mockUserPayload = {
      id: 'e2e-user-123',
      email: 'e2e@test.com',
      alias: 'E2ETester',
    };
    // [FIXED] Use vi.mocked() to control the imported function
    vi.mocked(generateToken).mockReturnValue(mockToken);

    // ACT
    const response = await request(app)
      .post('/api/e2e/generate-test-token')
      .send(mockUserPayload);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ token: mockToken });

    expect(generateToken).toHaveBeenCalledWith(
      expect.objectContaining(mockUserPayload),
      'e2e-provider-token-placeholder'
    );
  });

  it('should return 400 if "id" is missing from the body', async () => {
    const invalidPayload = {
      email: 'e2e@test.com',
      alias: 'E2ETester',
    };
    const response = await request(app)
      .post('/api/e2e/generate-test-token')
      .send(invalidPayload);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid request body. Must include id, email, and alias.',
    });
    expect(generateToken).not.toHaveBeenCalled();
  });

  it('should return 400 if "email" is missing from the body', async () => {
    const invalidPayload = {
      id: 'e2e-user-123',
      alias: 'E2ETester',
    };
    const response = await request(app)
      .post('/api/e2e/generate-test-token')
      .send(invalidPayload);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid request body. Must include id, email, and alias.',
    });
    expect(generateToken).not.toHaveBeenCalled();
  });

  it('should return 500 if generateToken throws an error', async () => {
    const mockUserPayload = {
      id: 'e2e-user-123',
      email: 'e2e@test.com',
      alias: 'E2ETester',
    };
    // [FIXED] Use vi.mocked()
    vi.mocked(generateToken).mockImplementation(() => {
      throw new Error('Signing failed');
    });

    const response = await request(app)
      .post('/api/e2e/generate-test-token')
      .send(mockUserPayload);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to generate token.' });
  });
});
