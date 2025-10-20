import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { internalAuthMiddleware } from './network.middleware.js';

// Mock the config module to provide a predictable API key for tests
vi.mock('../../config.js', () => ({
    config: {
        internalApiKey: 'test-internal-api-key',
    },
}));

describe('Middleware (Unit)', () => {
    // Use Vitest's mock utilities to create mock objects for req, res, and next
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction = vi.fn();

    // Reset mocks before each test to ensure a clean state
    beforeEach(() => {
        mockRequest = {};
        mockResponse = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        nextFunction = vi.fn();
    });

    describe('internalAuthMiddleware', () => {
        it('should call next() if the correct API key is provided', () => {
            mockRequest.headers = {
                'x-internal-api-key': 'test-internal-api-key',
            };

            internalAuthMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            // Expect the 'next' function to have been called, allowing the request to proceed
            expect(nextFunction).toHaveBeenCalledOnce();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should return a 401 error if the API key is missing', () => {
            mockRequest.headers = {}; // No API key header

            internalAuthMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            // Expect a 401 status and a JSON error response
            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Unauthorized: Invalid internal API key.',
            });
            // The 'next' function should NOT be called
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should return a 401 error if the API key is incorrect', () => {
            mockRequest.headers = {
                'x-internal-api-key': 'wrong-key',
            };

            internalAuthMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Unauthorized: Invalid internal API key.',
            });
            expect(nextFunction).not.toHaveBeenCalled();
        });
    });
});
