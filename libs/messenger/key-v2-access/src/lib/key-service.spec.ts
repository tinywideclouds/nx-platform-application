// --- File: libs/messenger/data-access/secure-key.service.spec.ts ---

import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Mock } from 'vitest';

// --- PLATFORM IMPORTS (Mocked) ---
// We import the real types, but mock the implementation
import {
  URN,
  PublicKeys,
  deserializeJsonToPublicKeys,
} from '@nx-platform-application/platform-types';

// --- Mock the platform-types lib ---
vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual, // Keep URN and other real types
    deserializeJsonToPublicKeys: vi.fn(), // <-- MOCK THE DESERIALIZER
  };
});

// --- Service Under Test ---
import { SecureKeyService } from './key-service';

describe('SecureKeyService', () => {
  let service: SecureKeyService;
  let httpMock: HttpTestingController;

  // Cast the mock
  const mockDeserialize = deserializeJsonToPublicKeys as Mock;

  const mockUserUrn = URN.parse('urn:sm:user:test-user');
  const mockApiUrl = '/api/v2/keys/urn:sm:user:test-user';

  // The "smart" object our service expects back from the deserializer
  const mockPublicKeys: PublicKeys = {
    encKey: new Uint8Array([1, 2, 3]),
    sigKey: new Uint8Array([4, 5, 6]),
  };

  // The raw JSON object from the API
  const mockJsonResponse = {
    encKey: 'AQID', // Base64 for [1,2,3]
    sigKey: 'BAUG', // Base64 for [4,5,6]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SecureKeyService],
    });
    service = TestBed.inject(SecureKeyService);
    httpMock = TestBed.inject(HttpTestingController);

    // Reset mocks
    mockDeserialize.mockClear();
    mockDeserialize.mockReturnValue(mockPublicKeys); // Default mock behavior
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

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

    // Assert: We got the correct cached data
    expect(keys).toBe(mockPublicKeys);
  });
});
