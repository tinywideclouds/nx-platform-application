import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exchangeAuthCode,
  refreshAccessToken,
  revokeToken,
} from './google.service.js';

// Mock config
vi.mock('../../config.js', () => ({
  config: {
    googleClientId: 'mock-client-id',
    googleClientSecret: 'mock-client-secret',
  },
}));

// Mock logger
vi.mock('@nx-platform-application/node-logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GoogleService (Internal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exchangeAuthCode', () => {
    it('should return tokens on success', async () => {
      // ARRANGE
      const mockResponse = {
        access_token: 'ac-123',
        refresh_token: 'rf-456',
        expires_in: 3600,
        scope: 'drive.file',
        token_type: 'Bearer',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // ACT
      const result = await exchangeAuthCode('auth-code-123');

      // ASSERT
      expect(result).toEqual({
        accessToken: 'ac-123',
        refreshToken: 'rf-456',
        expiresIn: 3600,
        scope: 'drive.file',
      });

      // Verify parameters (especially redirect_uri)
      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('redirect_uri')).toBe('postmessage');
      expect(body.get('grant_type')).toBe('authorization_code');
    });

    it('should throw if exchange fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Error details',
      });

      await expect(exchangeAuthCode('bad-code')).rejects.toThrow(
        'Google exchange failed',
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new access token on success', async () => {
      const mockResponse = {
        access_token: 'new-ac-789',
        expires_in: 3599,
        token_type: 'Bearer',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await refreshAccessToken('valid-refresh-token');

      expect(result.accessToken).toBe('new-ac-789');
      expect(result.expiresIn).toBe(3599);
    });

    it('should identify invalid_grant errors specifically', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"error": "invalid_grant"}',
      });

      await expect(refreshAccessToken('revoked-token')).rejects.toThrow(
        'REFRESH_TOKEN_INVALID',
      );
    });
  });

  describe('revokeToken', () => {
    it('should attempt to call the revoke endpoint', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await revokeToken('some-token');

      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0] as string;
      expect(url).toContain('revoke');
    });
  });
});
