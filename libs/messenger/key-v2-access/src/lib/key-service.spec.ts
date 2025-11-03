// --- File: libs/messenger/key-v2-access/src/key-service.spec.ts ---

import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Mock } from 'vitest';

// --- PLATFORM IMPORTS (Mocked) ---
import {
  URN,
  PublicKeys,
  deserializeJsonToPublicKeys,
  serializePublicKeysToJson, // <-- ADDED
} from '@nx-platform-application/platform-types';

// --- Mock the platform-types lib ---
vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual, // Keep URN and other real types
    deserializeJsonToPublicKeys: vi.fn(), // <-- MOCK THE DESERIALIZER
    serializePublicKeysToJson: vi.fn(), // <-- MOCK THE SERIALIZER
  };
});

// --- Service Under Test ---
import { SecureKeyService } from './key-service';

describe('SecureKeyService', () => {
  let service: SecureKeyService;
  let httpMock: HttpTestingController;

  // --- Mocks ---
  let mockDeserialize: Mock;
  let mockSerialize: Mock;

  // --- Fixtures ---
  const mockUserUrn = URN.parse('urn:sm:user:test-user');
  const mockApiUrl = '/api/v2/keys/urn:sm:user:test-user';

  // "Read" fixtures
  const mockJsonResponse = { encKey: 'b64...', sigKey: 'b64...' };
  const mockPublicKeys = {
    encKey: new Uint8Array([1, 2, 3]),
    sigKey: new Uint8Array([4, 5, 6]),
  } as PublicKeys;

  // "Write" fixtures
  const mockSerializedJson = { encKey: 'b64...', sigKey: 'b64...' };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SecureKeyService],
    });

    service = TestBed.inject(SecureKeyService);
    httpMock = TestBed.inject(HttpTestingController);

    // Assign mocks (style note applied)
    mockDeserialize = deserializeJsonToPublicKeys as Mock;
    mockSerialize = serializePublicKeysToJson as Mock;

    // Default mock behavior
    mockDeserialize.mockReturnValue(mockPublicKeys);
    mockSerialize.mockReturnValue(mockSerializedJson);
  });

  afterEach(() => {
    service.clearCache();
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- GET KEY (Read) ---
  describe('getKey', () => {
    it('should fetch keys from the v2 API and use the deserializer', async () => {
      // Act
      const promise = service.getKey(mockUserUrn);

      // Assert: Check HTTP call
      const req = httpMock.expectOne(mockApiUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockJsonResponse); // Respond with raw JSON

      // Await result
      const keys = await promise;

      // Assert: Check deserializer
      expect(mockDeserialize).toHaveBeenCalledWith(mockJsonResponse);

      // Assert: Final result
      expect(keys).toBe(mockPublicKeys);
    });

    it('should return keys from cache on subsequent calls', async () => {
      // --- First Call (to populate cache) ---
      const promise1 = service.getKey(mockUserUrn);
      httpMock.expectOne(mockApiUrl).flush(mockJsonResponse);
      await promise1;

      // Reset mocks to ensure they aren't called again
      mockDeserialize.mockClear();

      // --- Second Call (should hit cache) ---
      const keys = await service.getKey(mockUserUrn);

      // Assert: No HTTP call was made
      httpMock.expectNone(mockApiUrl);

      // Assert: Deserializer was not called
      expect(mockDeserialize).not.toHaveBeenCalled();

      // Assert: Returned cached object
      expect(keys).toBe(mockPublicKeys);
    });
  });

  // --- STORE KEYS (Write) ---
  describe('storeKeys', () => {
    it('should serialize, POST to v2 API, and clear cache on success', async () => {
      // --- 1. (Optional) Populate cache to verify clearing ---
      const p1 = service.getKey(mockUserUrn);
      httpMock.expectOne(mockApiUrl).flush(mockJsonResponse);
      await p1;

      // --- 2. Act: Call storeKeys ---
      const storePromise = service.storeKeys(mockUserUrn, mockPublicKeys);

      // Assert: Check HTTP POST call
      const req = httpMock.expectOne(mockApiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(mockSerializedJson);
      req.flush(null, { status: 200, statusText: 'OK' }); // Respond 200

      // Await result
      await storePromise;

      // Assert: Check Serializer
      expect(mockSerialize).toHaveBeenCalledWith(mockPublicKeys);

      // --- 3. Verify Cache Invalidation ---
      // Act: Call getKey again
      const p2 = service.getKey(mockUserUrn);

      // Assert: A *new* GET request is made, proving cache was cleared
      const req2 = httpMock.expectOne(mockApiUrl);
      expect(req2.request.method).toBe('GET');
      req2.flush(mockJsonResponse);
      await p2;
    });
  });
});
