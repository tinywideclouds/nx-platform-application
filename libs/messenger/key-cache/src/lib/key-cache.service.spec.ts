// --- FILE: libs/messenger/key-cache-access/src/lib/key-cache.service.spec.ts ---

import { TestBed } from '@angular/core/testing';
import { Mock, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import {
  URN,
  PublicKeys,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { SecureKeyService } from '@nx-platform-application/messenger-key-access';
// FIX: Import the correct storage service
import {
  KeyStorageService,
  PublicKeyRecord,
} from '@nx-platform-application/messenger-key-storage';

import { KeyCacheService } from './key-cache.service';

// --- Mock the platform-types lib ---
vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    deserializeJsonToPublicKeys: vi.fn(),
    serializePublicKeysToJson: vi.fn(),
  };
});

// --- Mock Dependencies ---
const mockSecureKeyService = {
  getKey: vi.fn(),
};
// FIX: Mock the correct KeyStorageService
const mockKeyStorageService = {
  getKey: vi.fn(),
  storeKey: vi.fn(),
  clearDatabase: vi.fn(),
};

// --- Fixtures ---
const mockUserUrn = URN.parse('urn:contacts:user:test-user');
const mockUserUrnString = mockUserUrn.toString();

// Deterministic mock timestamps
const mockNowInstant = Temporal.Instant.from('2025-11-10T10:00:00Z');
const mockOneHourAgoInstant = mockNowInstant.subtract({ hours: 1 });
const mockTwoDaysAgoInstant = mockNowInstant.subtract({ hours: 48 });

const isoNow = mockNowInstant.toString() as ISODateTimeString;
const isoOneHourAgo = mockOneHourAgoInstant.toString() as ISODateTimeString;
const isoTwoDaysAgo = mockTwoDaysAgoInstant.toString() as ISODateTimeString;

// JSON/Smart object fixtures
const mockJsonKeys: Record<string, string> = {
  encKey: 'b64...',
  sigKey: 'b64...',
};
const mockPublicKeys = {
  encKey: new Uint8Array([1, 2, 3]),
  sigKey: new Uint8Array([4, 5, 6]),
} as PublicKeys;

describe('KeyCacheService', () => {
  let service: KeyCacheService;
  let mockDeserialize: Mock;
  let mockSerialize: Mock;

  // --- Mock Temporal.Now.instant() ---
  const temporalNowSpy = vi
    .spyOn(Temporal.Now, 'instant')
    .mockImplementation(() => mockNowInstant);

  beforeEach(async () => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        KeyCacheService,
        { provide: SecureKeyService, useValue: mockSecureKeyService },
        // FIX: Provide the mock for the correct token
        { provide: KeyStorageService, useValue: mockKeyStorageService },
      ],
    });

    service = TestBed.inject(KeyCacheService);

    const mappers = await import('@nx-platform-application/platform-types');
    mockDeserialize = mappers.deserializeJsonToPublicKeys as Mock;
    mockSerialize = mappers.serializePublicKeysToJson as Mock;

    // Default mock behaviors
    mockDeserialize.mockReturnValue(mockPublicKeys);
    mockSerialize.mockReturnValue(mockJsonKeys);
    mockSecureKeyService.getKey.mockResolvedValue(mockPublicKeys);
    mockKeyStorageService.storeKey.mockResolvedValue(undefined);
  });

  afterAll(() => {
    temporalNowSpy.mockRestore();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('[Cache Miss] should fetch from network if key not in cache', async () => {
    mockKeyStorageService.getKey.mockResolvedValue(undefined);

    const result = await service.getPublicKey(mockUserUrn);

    expect(mockKeyStorageService.getKey).toHaveBeenCalledWith(
      mockUserUrnString
    );
    expect(mockSecureKeyService.getKey).toHaveBeenCalledWith(mockUserUrn);
    expect(mockSerialize).toHaveBeenCalledWith(mockPublicKeys);
    expect(mockKeyStorageService.storeKey).toHaveBeenCalledWith(
      mockUserUrnString,
      mockJsonKeys,
      isoNow
    );
    expect(result).toBe(mockPublicKeys);
  });

  it('[Cache Stale] should fetch from network if key is expired (stale)', async () => {
    const staleRecord: PublicKeyRecord = {
      urn: mockUserUrnString,
      keys: mockJsonKeys,
      timestamp: isoTwoDaysAgo, // 2 days ago, > 24h TTL
    };
    mockKeyStorageService.getKey.mockResolvedValue(staleRecord);

    const result = await service.getPublicKey(mockUserUrn);

    expect(mockKeyStorageService.getKey).toHaveBeenCalledWith(
      mockUserUrnString
    );
    expect(mockSecureKeyService.getKey).toHaveBeenCalledWith(mockUserUrn);
    expect(mockKeyStorageService.storeKey).toHaveBeenCalledWith(
      mockUserUrnString,
      mockJsonKeys,
      isoNow
    );
    expect(mockDeserialize).not.toHaveBeenCalled();
    expect(result).toBe(mockPublicKeys);
  });

  it('[Cache Hit] should return from cache if key is fresh', async () => {
    const freshRecord: PublicKeyRecord = {
      urn: mockUserUrnString,
      keys: mockJsonKeys,
      timestamp: isoOneHourAgo, // 1 hour ago, < 24h TTL
    };
    mockKeyStorageService.getKey.mockResolvedValue(freshRecord);

    const result = await service.getPublicKey(mockUserUrn);

    expect(mockKeyStorageService.getKey).toHaveBeenCalledWith(
      mockUserUrnString
    );
    expect(mockDeserialize).toHaveBeenCalledWith(mockJsonKeys);
    expect(mockSecureKeyService.getKey).not.toHaveBeenCalled();
    expect(mockKeyStorageService.storeKey).not.toHaveBeenCalled();
    expect(result).toBe(mockPublicKeys);
  });

  describe('hasKeys', () => {
    it('should return true if keys are found (cache or network)', async () => {
      // Simulate success
      mockKeyStorageService.getKey.mockResolvedValue(undefined); // Cache miss
      mockSecureKeyService.getKey.mockResolvedValue(mockPublicKeys); // Net success

      const result = await service.hasKeys(mockUserUrn);
      expect(result).toBe(true);
    });

    it('should return false if fetch throws error', async () => {
      // Simulate 404
      mockKeyStorageService.getKey.mockResolvedValue(undefined);
      mockSecureKeyService.getKey.mockRejectedValue(new Error('404 Not Found'));

      const result = await service.hasKeys(mockUserUrn);
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should call clearDatabase on storage service', async () => {
      await service.clear();
      expect(mockKeyStorageService.clearDatabase).toHaveBeenCalled();
    });
  });
});
