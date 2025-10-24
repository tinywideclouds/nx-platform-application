import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ensureAuthenticated } from './auth.middleware.js';

// This is the type for an authenticated request from the Express/Passport types.
// We'll use it in our cast for clarity.
type AuthenticatedRequest = Request & { user: unknown };

describe('ensureAuthenticated Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    nextFunction = vi.fn();
  });

  it('should call next() if req.isAuthenticated() is true', () => {
    // ARRANGE: Simulate an authenticated request
    // CHANGED: We now cast the function to the required type predicate signature.
    // This tells TypeScript to trust us that this mock satisfies the type.
    mockRequest.isAuthenticated = (() =>
      true) as () => this is AuthenticatedRequest;

    // ACT
    ensureAuthenticated(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // ASSERT
    expect(nextFunction).toHaveBeenCalledOnce();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return a 401 error if req.isAuthenticated() is false', () => {
    // ARRANGE: Simulate an unauthenticated request
    // CHANGED: We cast this function as well for type consistency.
    mockRequest.isAuthenticated = (() =>
      false) as () => this is AuthenticatedRequest;

    // ACT
    ensureAuthenticated(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // ASSERT
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'User is not authenticated.',
    });
  });
});
