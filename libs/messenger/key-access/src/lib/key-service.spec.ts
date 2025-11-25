// libs/messenger/messenger-key-access/src/lib/key-service.spec.ts

import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Mock, vi } from 'vitest';

import {
  URN,
  PublicKeys,
  deserializeJsonToPublicKeys,
  serializePublicKeysToJson,
} from '@nx-platform-application/platform-types';

// --- Mock the platform-types lib ---
vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual, // Keep URN and other real types
    deserializeJsonToPublicKeys: vi.fn(),
    serializePublicKeysToJson: vi.fn(),
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
  const mockApiUrl = 'api/keys/urn:sm:user:test-user';

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

    // Assign mocks
    mockDeserialize = deserializeJsonToPublicKeys as Mock;
    mockSerialize = serializePublicKeysToJson as Mock;

    // Reset and Default behavior
    vi.clearAllMocks();
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
    it('should fetch keys from the API and use the deserializer', async () => {
      const promise = service.getKey(mockUserUrn);

      const req = httpMock.expectOne(mockApiUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockJsonResponse); 

      const keys = await promise;

      expect(mockDeserialize).toHaveBeenCalledWith(mockJsonResponse);
      expect(keys).toBe(mockPublicKeys);
    });

    it('should return keys from cache on subsequent calls', async () => {
      // First Call
      const promise1 = service.getKey(mockUserUrn);
      httpMock.expectOne(mockApiUrl).flush(mockJsonResponse);
      await promise1;

      mockDeserialize.mockClear();

      // Second Call
      const keys = await service.getKey(mockUserUrn);

      httpMock.expectNone(mockApiUrl);
      expect(mockDeserialize).not.toHaveBeenCalled();
      expect(keys).toBe(mockPublicKeys);
    });

    // NEW TEST CASE: 404 Handling
    it('should return null (and not throw) when API returns 404 Not Found', async () => {
      // Act
      const promise = service.getKey(mockUserUrn);

      // Assert HTTP
      const req = httpMock.expectOne(mockApiUrl);
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      // Assert Result
      const result = await promise;
      expect(result).toBeNull();
      // Ensure deserializer was NOT called on error
      expect(mockDeserialize).not.toHaveBeenCalled();
    });

    // NEW TEST CASE: 500 Handling
    it('should re-throw errors other than 404', async () => {
      // Act
      const promise = service.getKey(mockUserUrn);

      // Assert HTTP
      const req = httpMock.expectOne(mockApiUrl);
      req.flush('Internal Server Error', { status: 500, statusText: 'Error' });

      // Assert Exception
      await expect(promise).rejects.toThrow();
    });
  });

  // --- STORE KEYS (Write) ---
  describe('storeKeys', () => {
    it('should serialize, POST to API, and clear cache on success', async () => {
      // Populate cache
      const p1 = service.getKey(mockUserUrn);
      httpMock.expectOne(mockApiUrl).flush(mockJsonResponse);
      await p1;

      // Call storeKeys
      const storePromise = service.storeKeys(mockUserUrn, mockPublicKeys);

      const req = httpMock.expectOne(mockApiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(mockSerializedJson);
      req.flush(null, { status: 200, statusText: 'OK' }); 

      await storePromise;

      expect(mockSerialize).toHaveBeenCalledWith(mockPublicKeys);

      // Verify Cache Invalidation
      const p2 = service.getKey(mockUserUrn);
      const req2 = httpMock.expectOne(mockApiUrl);
      expect(req2.request.method).toBe('GET');
      req2.flush(mockJsonResponse);
      await p2;
    });
  });
});