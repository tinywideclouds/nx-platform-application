import { TestBed } from '@angular/core/testing';
import { Mock, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import {
  URN,
  PublicKeys,
  ISODateTimeString,
  KeyNotFoundError,
} from '@nx-platform-application/platform-types';
import { SecureKeyService } from '@nx-platform-application/messenger-infrastructure-key-access';
import {
  KeyStorageService,
  PublicKeyRecord,
} from '@nx-platform-application/messenger-infrastructure-key-storage';

import { KeyCacheService } from './key-cache.service';

// Mock the platform-types helpers
vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    deserializeJsonToPublicKeys: vi.fn(),
    serializePublicKeysToJson: vi.fn(),
  };
});

const mockSecureKeyService = {
  getKey: vi.fn(),
  storeKeys: vi.fn(),
};

const mockKeyStorageService = {
  getKey: vi.fn(),
  storeKey: vi.fn(),
  clearDatabase: vi.fn(),
};

const mockUserUrn = URN.parse('urn:contacts:user:test-user');
// Removed: const mockUserUrnString = mockUserUrn.toString();

const mockNowInstant = Temporal.Instant.from('2025-11-10T10:00:00Z');
const isoNow = mockNowInstant.toString() as ISODateTimeString;

const mockPublicKeys: PublicKeys = {
  encKey: new Uint8Array([1]),
  sigKey: new Uint8Array([2]),
};

const mockJsonKeys = {
  encKey: 'b64...',
  sigKey: 'b64...',
};

// Mock Serializers
import {
  serializePublicKeysToJson,
  deserializeJsonToPublicKeys,
} from '@nx-platform-application/platform-types';

const mockSerialize = serializePublicKeysToJson as Mock;
const mockDeserialize = deserializeJsonToPublicKeys as Mock;

describe('KeyCacheService', () => {
  let service: KeyCacheService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup defaults
    mockSerialize.mockReturnValue(mockJsonKeys);
    mockDeserialize.mockReturnValue(mockPublicKeys);

    // Freeze time
    vi.useFakeTimers();

    vi.spyOn(Temporal.Now, 'instant').mockReturnValue(mockNowInstant);
    TestBed.configureTestingModule({
      providers: [
        KeyCacheService,
        { provide: SecureKeyService, useValue: mockSecureKeyService },
        { provide: KeyStorageService, useValue: mockKeyStorageService },
      ],
    });
    service = TestBed.inject(KeyCacheService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPublicKey', () => {
    it('should fetch from network if key not in cache', async () => {
      mockKeyStorageService.getKey.mockResolvedValue(undefined);
      mockSecureKeyService.getKey.mockResolvedValue(mockPublicKeys);

      const result = await service.getPublicKey(mockUserUrn);

      // ✅ FIX: Expect URN Object, not string
      expect(mockKeyStorageService.getKey).toHaveBeenCalledWith(mockUserUrn);

      expect(mockSecureKeyService.getKey).toHaveBeenCalledWith(mockUserUrn);
      expect(mockKeyStorageService.storeKey).toHaveBeenCalledWith(
        mockUserUrn, // ✅ FIX
        mockJsonKeys,
        isoNow,
      );
      expect(result).toEqual(mockPublicKeys);
    });

    it('should fetch from network if key is expired (stale)', async () => {
      // 17 hours ago
      const oldTime = mockNowInstant.subtract({ hours: 17 }).toString();

      mockKeyStorageService.getKey.mockResolvedValue({
        urn: mockUserUrn.toString(),
        keys: mockJsonKeys,
        timestamp: oldTime as ISODateTimeString,
      } as PublicKeyRecord);

      mockSecureKeyService.getKey.mockResolvedValue(mockPublicKeys);

      const result = await service.getPublicKey(mockUserUrn);

      expect(mockKeyStorageService.getKey).toHaveBeenCalledWith(mockUserUrn);
      expect(mockSecureKeyService.getKey).toHaveBeenCalledWith(mockUserUrn); // Network call triggered
      expect(result).toEqual(mockPublicKeys);
    });

    it('should return from cache if key is fresh', async () => {
      // 1 hour ago (Fresh)
      const freshTime = mockNowInstant.subtract({ hours: 1 }).toString();

      mockKeyStorageService.getKey.mockResolvedValue({
        urn: mockUserUrn.toString(),
        keys: mockJsonKeys,
        timestamp: freshTime as ISODateTimeString,
      } as PublicKeyRecord);

      const result = await service.getPublicKey(mockUserUrn);

      expect(mockKeyStorageService.getKey).toHaveBeenCalledWith(mockUserUrn);
      expect(mockSecureKeyService.getKey).not.toHaveBeenCalled(); // No Network
      expect(mockDeserialize).toHaveBeenCalledWith(mockJsonKeys);
      expect(result).toEqual(mockPublicKeys);
    });

    it('should bubble up KeyNotFoundError if network fetch fails with 204', async () => {
      mockKeyStorageService.getKey.mockResolvedValue(undefined);
      mockSecureKeyService.getKey.mockRejectedValue(
        new KeyNotFoundError(mockUserUrn.toString()),
      );

      await expect(service.getPublicKey(mockUserUrn)).rejects.toThrow(
        KeyNotFoundError,
      );
    });

    it('should bubble up generic Error if network fetch fails with 500', async () => {
      mockKeyStorageService.getKey.mockResolvedValue(undefined);
      mockSecureKeyService.getKey.mockRejectedValue(new Error('Network Error'));

      await expect(service.getPublicKey(mockUserUrn)).rejects.toThrow(
        'Network Error',
      );
    });
  });

  describe('hasKeys', () => {
    it('should return true if keys are found (cache or network)', async () => {
      // Setup successful flow
      mockKeyStorageService.getKey.mockResolvedValue(undefined);
      mockSecureKeyService.getKey.mockResolvedValue(mockPublicKeys);

      const result = await service.hasKeys(mockUserUrn);
      expect(result).toBe(true);
    });

    it('should return false if fetch throws KeyNotFoundError (204)', async () => {
      mockKeyStorageService.getKey.mockResolvedValue(undefined);
      mockSecureKeyService.getKey.mockRejectedValue(
        new KeyNotFoundError(mockUserUrn.toString()),
      );

      const result = await service.hasKeys(mockUserUrn);
      expect(result).toBe(false);
    });

    it('should return false if fetch throws generic Error', async () => {
      mockKeyStorageService.getKey.mockResolvedValue(undefined);
      mockSecureKeyService.getKey.mockRejectedValue(new Error('404 Not Found'));

      const result = await service.hasKeys(mockUserUrn);
      expect(result).toBe(false);
    });
  });

  describe('storeKeys', () => {
    it('should upload to network and cache locally', async () => {
      await service.storeKeys(mockUserUrn, mockPublicKeys);

      expect(mockSecureKeyService.storeKeys).toHaveBeenCalledWith(
        mockUserUrn,
        mockPublicKeys,
      );
      expect(mockSerialize).toHaveBeenCalledWith(mockPublicKeys);

      // ✅ FIX: Expect URN Object
      expect(mockKeyStorageService.storeKey).toHaveBeenCalledWith(
        mockUserUrn,
        mockJsonKeys,
        isoNow,
      );
    });
  });

  describe('clear', () => {
    it('should call clearDatabase on storage service', async () => {
      await service.clear();
      expect(mockKeyStorageService.clearDatabase).toHaveBeenCalled();
    });
  });
});
