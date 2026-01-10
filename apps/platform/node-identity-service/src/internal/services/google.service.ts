import { config } from '../../config.js';
import { logger } from '@nx-platform-application/node-logger';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string; // Only present on first exchange or if forced
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface ExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

/**
 * Exchanges a short-lived authorization code for long-lived tokens.
 *
 * @param code - The one-time code received from the frontend (GIS SDK).
 */
export async function exchangeAuthCode(code: string): Promise<ExchangeResult> {
  const params = new URLSearchParams();
  params.append('client_id', config.googleClientId || '');
  params.append('client_secret', config.googleClientSecret || '');
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  // CRITICAL: GIS SDK requires this exact string, not a real URL.
  params.append('redirect_uri', 'postmessage');

  try {
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        { status: response.status, body: errorBody },
        '[GoogleService] Token exchange failed',
      );
      throw new Error(`Google exchange failed: ${response.statusText}`);
    }

    const data = (await response.json()) as GoogleTokenResponse;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token, // May be undefined if user re-links without revoke
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  } catch (error) {
    logger.error({ err: error }, '[GoogleService] Exchange network error');
    throw error;
  }
}

/**
 * Uses a secure refresh token to request a new access token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams();
  params.append('client_id', config.googleClientId || '');
  params.append('client_secret', config.googleClientSecret || '');
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');

  try {
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // Handle "Token Expired/Revoked" specifically if needed
      if (response.status === 400 && errorBody.includes('invalid_grant')) {
        throw new Error('REFRESH_TOKEN_INVALID');
      }

      logger.error(
        { status: response.status, body: errorBody },
        '[GoogleService] Token refresh failed',
      );
      throw new Error(`Google refresh failed: ${response.statusText}`);
    }

    const data = (await response.json()) as GoogleTokenResponse;

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'REFRESH_TOKEN_INVALID') {
      throw error; // Re-throw known domain errors
    }
    logger.error({ err: error }, '[GoogleService] Refresh network error');
    throw error;
  }
}

/**
 * Revokes a token (access or refresh) to clean up permissions.
 * We do this on disconnect.
 */
export async function revokeToken(token: string): Promise<void> {
  const params = new URLSearchParams();
  params.append('token', token);

  try {
    // We send a POST to revoke (fire and forget mostly)
    await fetch(GOOGLE_REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
  } catch (error) {
    logger.warn({ err: error }, '[GoogleService] Revoke failed (non-critical)');
    // We do not throw here; if we deleted it from our DB, that's what matters most.
  }
}
