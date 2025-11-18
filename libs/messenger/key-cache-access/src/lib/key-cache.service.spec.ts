// --- FILE: libs/messenger/key-cache-access/src/lib/key-cache.service.spec.ts ---

import { TestBed } from '@angular/core/testing';
import { Mock, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill'; // <-- ADDED

import {
  URN,
  PublicKeys,
  deserializeJsonToPublicKeys,
  serializePublicKeysToJson,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { SecureKeyService } from '@nx-platform-application/messenger-key-access';
import {
  ChatStorageService,
  PublicKeyRecord,
} from '@nx-platform-application/chat-storage';

import { KeyCacheService } from './key-cache.service';

// --- Mock the platform-types lib (same as before) ---
vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    deserializeJsonToPublicKeys: vi.fn(),
    serializePublicKeysToJson: vi.fn(),
  };
});

// --- Mock Dependencies (same as before) ---
const mockSecureKeyService = {
  getKey: vi.fn(),
};
const mockChatStorageService = {
  getKey: vi.fn(),
  storeKey: vi.fn(),
};

// --- Fixtures (Refactored for Temporal) ---
const mockUserUrn = URN.parse('urn:sm:user:test-user');
const mockUserUrnString = mockUserUrn.toString();

// Deterministic mock timestamps
const mockNowInstant = Temporal.Instant.from('2025-11-10T10:00:00Z');
const mockOneHourAgoInstant = mockNowInstant.subtract({ hours: 1 });
const mockTwoDaysAgoInstant = mockNowInstant.subtract({ hours: 48 });

const isoNow = mockNowInstant.toString() as ISODateTimeString;
const isoOneHourAgo = mockOneHourAgoInstant.toString() as ISODateTimeString;
const isoTwoDaysAgo = mockTwoDaysAgoInstant.toString() as ISODateTimeString;

// JSON/Smart object fixtures (same as before)
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
        { provide: ChatStorageService, useValue: mockChatStorageService },
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
    mockChatStorageService.storeKey.mockResolvedValue(undefined);
  });
  
  afterAll(() => {
    temporalNowSpy.mockRestore(); // Restore Temporal.Now
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('[Cache Miss] should fetch from network if key not in cache', async () => {
    mockChatStorageService.getKey.mockResolvedValue(undefined);

    const result = await service.getPublicKey(mockUserUrn);

    expect(mockChatStorageService.getKey).toHaveBeenCalledWith(mockUserUrnString);
    expect(mockSecureKeyService.getKey).toHaveBeenCalledWith(mockUserUrn);
    expect(mockSerialize).toHaveBeenCalledWith(mockPublicKeys);
    expect(mockChatStorageService.storeKey).toHaveBeenCalledWith(
      mockUserUrnString,
      mockJsonKeys,
      isoNow // Based on our Temporal.Now mock
    );
    expect(result).toBe(mockPublicKeys);
  });

  it('[Cache Stale] should fetch from network if key is expired (stale)', async () => {
    const staleRecord: PublicKeyRecord = {
      urn: mockUserUrnString,
      keys: mockJsonKeys,
      timestamp: isoTwoDaysAgo, // 2 days ago, > 24h TTL
    };
    mockChatStorageService.getKey.mockResolvedValue(staleRecord);

    const result = await service.getPublicKey(mockUserUrn);

    expect(mockChatStorageService.getKey).toHaveBeenCalledWith(mockUserUrnString);
    expect(mockSecureKeyService.getKey).toHaveBeenCalledWith(mockUserUrn);
    expect(mockChatStorageService.storeKey).toHaveBeenCalledWith(
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
    mockChatStorageService.getKey.mockResolvedValue(freshRecord);

    const result = await service.getPublicKey(mockUserUrn);

    expect(mockChatStorageService.getKey).toHaveBeenCalledWith(mockUserUrnString);
    expect(mockDeserialize).toHaveBeenCalledWith(mockJsonKeys);
    expect(mockSecureKeyService.getKey).not.toHaveBeenCalled();
    expect(mockChatStorageService.storeKey).not.toHaveBeenCalled();
    expect(result).toBe(mockPublicKeys);
  });

  describe('hasKeys', () => {
    it('should return true if keys are found (cache or network)', async () => {
      // Simulate success
      mockChatStorageService.getKey.mockResolvedValue(undefined); // Cache miss
      mockSecureKeyService.getKey.mockResolvedValue(mockPublicKeys); // Net success

      const result = await service.hasKeys(mockUserUrn);
      expect(result).toBe(true);
    });

    it('should return false if fetch throws error', async () => {
      // Simulate 404
      mockChatStorageService.getKey.mockResolvedValue(undefined);
      mockSecureKeyService.getKey.mockRejectedValue(new Error('404 Not Found'));

      const result = await service.hasKeys(mockUserUrn);
      expect(result).toBe(false);
    });
  });
});