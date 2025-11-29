import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createJwtAuthMiddleware } from '../lib/jwt-verifier.middleware';
// --- 1. Import URN ---
import { URN } from '@nx-platform-application/platform-types';

// --- MOCKS ---
const mocks = vi.hoisted(() => {
  return {
    mockAxiosGet: vi.fn(),
    mockJwtVerify: vi.fn(),
  };
});

vi.mock('axios', async (importActual) => {
  const actual = await importActual<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      get: mocks.mockAxiosGet,
    },
    get: mocks.mockAxiosGet,
  };
});

vi.mock('jose', async (importActual) => {
  const actual = await importActual<typeof import('jose')>();
  return {
    ...actual,
    jwtVerify: mocks.mockJwtVerify,
    createRemoteJWKSet: vi.fn(() => vi.fn()),
  };
});
// --- END MOCKS ---

// --- Mock Data ---
const MOCK_IDENTITY_URL = 'http://fake-identity-service.com';
const MOCK_USER_PAYLOAD = {
  // This comes from the JWT (a string)
  sub: 'urn:contacts:user:user-123',
  email: 'test@example.com',
  alias: 'Testy',
};

// --- 2. Update MOCK_USER_OBJECT to use a URN ---
// This is what req.user should look like after the middleware runs
const MOCK_USER_OBJECT = {
  id: URN.parse('urn:contacts:user:user-123'),
  email: 'test@example.com',
  alias: 'Testy',
};

// --- Mock Express Objects ---
const getMockRequest = (authHeader?: string): Request => {
  return {
    headers: { authorization: authHeader },
    log: { warn: vi.fn() },
  } as any;
};
const getMockResponse = (): Response => {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};
type MockNextFunction = NextFunction & ReturnType<typeof vi.fn>;

describe('jwt-verifier.middleware', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: MockNextFunction;
  let middleware: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockAxiosGet.mockResolvedValue({
      data: {
        jwks_uri: `${MOCK_IDENTITY_URL}/.well-known/jwks.json`,
      },
    });

    middleware = createJwtAuthMiddleware(MOCK_IDENTITY_URL);
    mockResponse = getMockResponse();
    mockNext = vi.fn();
  });

  it('should attach user to req and call next() on valid token', async () => {
    mockRequest = getMockRequest('Bearer valid-token-123');
    mocks.mockJwtVerify.mockResolvedValue({ payload: MOCK_USER_PAYLOAD });

    await middleware(mockRequest, mockResponse, mockNext);

    expect(mocks.mockJwtVerify).toHaveBeenCalledWith(
      'valid-token-123',
      expect.any(Function)
    );
    // --- 3. Assert against the URN-based object ---
    expect(mockRequest.user).toEqual(MOCK_USER_OBJECT);
    expect(mockRequest.user?.id).toBeInstanceOf(URN);
    // ---
    expect(mockNext).toHaveBeenCalledWith();
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should call next(error) if no Authorization header is provided', async () => {
    mockRequest = getMockRequest(undefined);

    await middleware(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized: No or invalid token provided.',
      })
    );
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockRequest.user).toBeUndefined();
  });

  it('should call next(error) if token is invalid or expired', async () => {
    mockRequest = getMockRequest('Bearer expired-or-invalid-token');
    const validationError = new Error('Token expired');
    mocks.mockJwtVerify.mockRejectedValue(validationError);

    await middleware(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith(validationError);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockRequest.user).toBeUndefined();
  });
});
