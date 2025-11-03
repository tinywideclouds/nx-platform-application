import type { Request, Response, NextFunction } from 'express';

// Mock the config module
vi.mock('../../config.js', () => ({
  config: {
    // Provide the predictable test secret
    e2eTestSecret: 'test-e2e-secret-key',
  },
}));

// Mock the environment
const originalEnv = process.env;

// Import the middleware *after* mocks are defined
import { e2eAuthMiddleware } from './e2e.middleware.js';

describe('e2eAuthMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    // Reset mocks
    mockRequest = {};
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    nextFunction = vi.fn();

    // Set default non-production environment
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should call next() if the correct E2E key is provided in a non-production env', () => {
    // ARRANGE
    mockRequest.headers = {
      'x-e2e-secret-key': 'test-e2e-secret-key', // The mocked key
    };

    // ACT
    e2eAuthMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // ASSERT
    expect(nextFunction).toHaveBeenCalledOnce();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return 401 if the E2E key is missing', () => {
    // ARRANGE
    mockRequest.headers = {}; // No key

    // ACT
    e2eAuthMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // ASSERT
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Invalid E2E secret key.',
    });
  });

  it('should return 401 if the E2E key is incorrect', () => {
    // ARRANGE
    mockRequest.headers = {
      'x-e2e-secret-key': 'wrong-key',
    };

    // ACT
    e2eAuthMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // ASSERT
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Invalid E2E secret key.',
    });
  });

  it('should return 404 Not Found if NODE_ENV is production', () => {
    // ARRANGE
    process.env.NODE_ENV = 'production';
    mockRequest.headers = {
      'x-e2e-secret-key': 'test-e2e-secret-key', // Key doesn't matter
    };

    // ACT
    e2eAuthMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // ASSERT
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Endpoint not found.',
    });
  });
});
