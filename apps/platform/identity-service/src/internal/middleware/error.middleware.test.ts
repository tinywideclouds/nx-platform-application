import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { centralErrorHandler } from './error.middleware.js';

// Create a mock logger to spy on its methods
const mockLogger = {
  error: vi.fn(),
} as unknown as Logger;

describe('centralErrorHandler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = vi.fn();
  let originalNodeEnv: string | undefined;

  // ADDED: Control the environment to test the production code path.
  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
  });

  // ADDED: Restore the original environment after tests in this file run.
  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = { log: mockLogger, id: 'test-request-id' };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it('should log the error and send a 500 response for a standard Error object', () => {
    const testError = new Error('Something went wrong!');

    centralErrorHandler(mockLogger)(
      testError,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockLogger.error).toHaveBeenCalledOnce();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        reqId: 'test-request-id',
        err: expect.objectContaining({
          message: 'Something went wrong!',
        }),
      }),
      'Unhandled error caught by central handler'
    );
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    // This assertion will now pass because NODE_ENV is 'production'
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'An internal server error occurred.',
    });
  });

  it('should handle non-Error objects gracefully', () => {
    const testError = 'A simple string was thrown';

    centralErrorHandler(mockLogger)(
      testError,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockLogger.error).toHaveBeenCalledOnce();
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'An internal server error occurred.',
    });
  });
});
