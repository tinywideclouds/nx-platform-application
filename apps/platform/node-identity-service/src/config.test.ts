
// Mock the pino logger
const mockFatal = vi.fn();
const mockLogger = {
  fatal: mockFatal,
};
vi.mock('pino', () => ({
  // Default export
  default: vi.fn(() => mockLogger),
}));

// Store original process.env
const originalEnv = { ...process.env };
const originalExit = process.exit;

// Mock process.exit
const exitMock = vi.fn((code?: number) => {
  throw new Error(`process.exit(${code}) called`);
}) as any;

// Baseline "good" environment variables
const baselineRequiredEnv = {
  GCP_PROJECT_ID: 'test-project',
  GOOGLE_CLIENT_ID: 'test-google-id',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
  GOOGLE_REDIRECT_URL_SUCCESS: 'http://test-success',
  GOOGLE_REDIRECT_URL_FAILURE: 'http://test-failure',
  GOOGLE_AUTH_CALLBACK: '/test-callback',
  JWT_SECRET: 'a-real-jwt-secret',
  JWT_AUDIENCE: 'test-audience',
  INTERNAL_API_KEY: 'test-internal-key',
  SESSION_SECRET: 'a-real-session-secret',
  CLIENT_URL: 'http://test-client',
  JWT_PRIVATE_KEY: 'a-crypto-lib-private-key-from-public-private-pair',
};
// --- End Mocks ---

describe('Application Configuration (config.ts)', () => {
  beforeEach(() => {
    vi.resetModules();
    exitMock.mockClear();
    mockFatal.mockClear(); // [CHANGED] Clear the logger mock
    process.exit = exitMock;

    process.env = {
      ...originalEnv,
      ...baselineRequiredEnv,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    process.exit = originalExit;
  });

  // --- Production Environment Tests ---
  describe('in Production (NODE_ENV=production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      delete process.env.E2E_TEST_SECRET;
    });

    it('should load successfully with valid production config', async () => {
      const { config } = await import('./config.js');
      expect(exitMock).not.toHaveBeenCalled();
      expect(mockFatal).not.toHaveBeenCalled(); // [CHANGED] Check logger mock
      expect(config.gcpProjectId).toBe('test-project');
    });

    it('should FATAL and exit if E2E_TEST_SECRET is set', async () => {
      process.env.E2E_TEST_SECRET = 'a-dangerous-secret';

      await expect(() => import('./config.js')).rejects.toThrow(
        'process.exit(1) called'
      );
      // [CHANGED] Check that the logger's fatal method was called
      expect(mockFatal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ConfigValidation' }),
        expect.stringContaining(
          'INSECURE: E2E_TEST_SECRET must not be set'
        )
      );
    });

    it('should FATAL and exit if default SESSION_SECRET is used', async () => {
      process.env.SESSION_SECRET = 'a-very-secret-key-for-dev'; // The default

      await expect(() => import('./config.js')).rejects.toThrow(
        'process.exit(1) called'
      );
      // [CHANGED] Check logger mock
      expect(mockFatal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ConfigValidation' }),
        expect.stringContaining('INSECURE: The default SESSION_SECRET')
      );
    });

    it('should FATAL and exit if a required variable is missing', async () => {
      delete process.env.GCP_PROJECT_ID;

      await expect(() => import('./config.js')).rejects.toThrow(
        'process.exit(1) called'
      );
      // [CHANGED] Check logger mock
      expect(mockFatal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ConfigValidation' }),
        expect.stringContaining(
          'Missing required environment variable: GCP_PROJECT_ID'
        )
      );
    });
  });

  // --- Non-Production Environment Tests ---
  describe('in Development (NODE_ENV=development)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.E2E_TEST_SECRET = 'a-safe-dev-secret';
    });

    it('should load successfully with E2E_TEST_SECRET', async () => {
      const { config } = await import('./config.js');
      expect(exitMock).not.toHaveBeenCalled();
      expect(mockFatal).not.toHaveBeenCalled(); // [CHANGED] Check logger mock
      expect(config.e2eTestSecret).toBe('a-safe-dev-secret');
    });

    it('should FATAL and exit if E2E_TEST_SECRET is missing', async () => {
      delete process.env.E2E_TEST_SECRET;

      await expect(() => import('./config.js')).rejects.toThrow(
        'process.exit(1) called'
      );
      // [CHANGED] Check logger mock
      expect(mockFatal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ConfigValidation' }),
        expect.stringContaining(
          'Missing required testing variable: E2E_TEST_SECRET'
        )
      );
    });

    it('should NOT exit if default development secrets are used', async () => {
      process.env.SESSION_SECRET = 'a-very-secret-key-for-dev';

      const { config } = await import('./config.js');
      expect(exitMock).not.toHaveBeenCalled();
      expect(mockFatal).not.toHaveBeenCalled(); // [CHANGED] Check logger mock
      expect(config.sessionSecret).toBe('a-very-secret-key-for-dev');
    });
  });
});
