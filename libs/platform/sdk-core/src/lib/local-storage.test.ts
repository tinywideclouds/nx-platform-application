import { LocalStorage } from './local-storage';
import { RawApplicationState } from '../types/models';
import { Temporal } from '@js-temporal/polyfill';
import { ISODateTimeString } from '../types/types';

// Helper to create a mock raw state for testing
const createMockRawState = (): RawApplicationState => ({
  locations: [],
  people: [],
  intentions: [],
  user: { id: 'user-123', name: 'Test User' },
  meta: {
    version: 1,
    createdAt: Temporal.Now.instant().toString() as ISODateTimeString,
  },
});

describe('LocalStorage', () => {
  let provider: LocalStorage;
  let mockState: RawApplicationState;
  const filePath = 'action-intention-state.json';

  // In-memory mock of the localStorage API
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    // Spy on the global window object and replace localStorage with our mock
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(localStorageMock as any);
    localStorageMock.clear();

    provider = new LocalStorage();
    mockState = createMockRawState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(provider).toBeTruthy();
  });

  describe('readFile', () => {
    it('should read and parse a raw state from localStorage', async () => {
      localStorageMock.setItem(filePath, JSON.stringify(mockState));

      const retrievedState = await provider.readFile(filePath);
      expect(retrievedState).toEqual(mockState);
    });

    it('should throw an error if the file does not exist', async () => {
      await expect(provider.readFile('non-existent-path')).rejects.toThrow(
        'File not found in localStorage at path: non-existent-path'
      );
    });
  });

  describe('writeFile', () => {
    it('should stringify and write a raw state to localStorage', async () => {
      await provider.writeFile(filePath, mockState);
      const storedItem = localStorageMock.getItem(filePath);
      expect(storedItem).toBe(JSON.stringify(mockState));
    });

    it('should return a file manifest on successful write', async () => {
      const manifest = await provider.writeFile(filePath, mockState);
      expect(manifest.path).toBe(filePath);
      expect(manifest.size).toBeGreaterThan(0);
      expect(manifest.lastModified).toBeInstanceOf(Temporal.Instant);
    });
  });

  describe('Key Pair Management', () => {
    const userId = 'test-user-keys';

    it('should save and load a key pair successfully', async () => {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['encrypt', 'decrypt']
      );

      await provider.saveKeyPair(userId, keyPair);
      const loadedPair = await provider.loadKeyPair(userId);

      expect(loadedPair).not.toBeNull();
      expect(loadedPair?.publicKey).toBeInstanceOf(CryptoKey);
      expect(loadedPair?.privateKey).toBeInstanceOf(CryptoKey);
    });

    it('loadKeyPair should return null if no key is stored', async () => {
      const result = await provider.loadKeyPair('non-existent-user');
      expect(result).toBeNull();
    });

    it('deleteKeyPair should remove the key from storage', async () => {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['encrypt', 'decrypt']
      );
      await provider.saveKeyPair(userId, keyPair);

      // Verify it's there
      expect(localStorageMock.getItem(`crypto_keys_${userId}`)).not.toBeNull();

      // Delete it
      await provider.deleteKeyPair(userId);

      // Verify it's gone
      expect(localStorageMock.getItem(`crypto_keys_${userId}`)).toBeNull();
    });
  });
});
