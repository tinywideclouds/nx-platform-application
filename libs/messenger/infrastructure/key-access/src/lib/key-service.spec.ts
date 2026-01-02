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
  KeyNotFoundError,
} from '@nx-platform-application/platform-types';

import { SecureKeyService } from './key-service';

vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    deserializeJsonToPublicKeys: vi.fn(),
    serializePublicKeysToJson: vi.fn(),
  };
});

describe('SecureKeyService', () => {
  let service: SecureKeyService;
  let httpMock: HttpTestingController;

  let mockDeserialize: Mock;
  let mockSerialize: Mock;

  const mockUserUrn = URN.parse('urn:contacts:user:test-user');
  const mockApiUrl = 'api/keys/urn:contacts:user:test-user';
  const mockJsonResponse = { encKey: 'b64...', sigKey: 'b64...' };
  const mockPublicKeys = {
    encKey: new Uint8Array([1, 2, 3]),
    sigKey: new Uint8Array([4, 5, 6]),
  } as PublicKeys;
  const mockSerializedJson = { encKey: 'b64...', sigKey: 'b64...' };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SecureKeyService],
    });

    service = TestBed.inject(SecureKeyService);
    httpMock = TestBed.inject(HttpTestingController);

    mockDeserialize = deserializeJsonToPublicKeys as Mock;
    mockSerialize = serializePublicKeysToJson as Mock;

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

  describe('getKey', () => {
    it('should fetch keys from the API (200 OK)', async () => {
      const promise = service.getKey(mockUserUrn);

      const req = httpMock.expectOne(mockApiUrl);
      expect(req.request.method).toBe('GET');

      req.flush(mockJsonResponse, { status: 200, statusText: 'OK' });

      const keys = await promise;
      expect(mockDeserialize).toHaveBeenCalledWith(mockJsonResponse);
      expect(keys).toBe(mockPublicKeys);
    });

    it('should return keys from cache on subsequent calls', async () => {
      const promise1 = service.getKey(mockUserUrn);
      httpMock
        .expectOne(mockApiUrl)
        .flush(mockJsonResponse, { status: 200, statusText: 'OK' });
      await promise1;

      mockDeserialize.mockClear();

      const keys = await service.getKey(mockUserUrn);

      httpMock.expectNone(mockApiUrl);
      expect(mockDeserialize).not.toHaveBeenCalled();
      expect(keys).toBe(mockPublicKeys);
    });

    it('should throw KeyNotFoundError when API returns 204 No Content', async () => {
      const promise = service.getKey(mockUserUrn);

      const req = httpMock.expectOne(mockApiUrl);
      req.flush(null, { status: 204, statusText: 'No Content' });

      await expect(promise).rejects.toThrow(KeyNotFoundError);
    });

    it('should throw HttpError when API returns 404 Not Found', async () => {
      const promise = service.getKey(mockUserUrn);

      const req = httpMock.expectOne(mockApiUrl);
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      await expect(promise).rejects.toThrow();
    });

    it('should throw HttpError when API returns 500', async () => {
      const promise = service.getKey(mockUserUrn);

      const req = httpMock.expectOne(mockApiUrl);
      req.flush('Internal Server Error', { status: 500, statusText: 'Error' });

      await expect(promise).rejects.toThrow();
    });
  });

  describe('storeKeys', () => {
    it('should serialize, POST to API, and clear cache on success', async () => {
      const p1 = service.getKey(mockUserUrn);
      httpMock
        .expectOne(mockApiUrl)
        .flush(mockJsonResponse, { status: 200, statusText: 'OK' });
      await p1;

      const storePromise = service.storeKeys(mockUserUrn, mockPublicKeys);

      const req = httpMock.expectOne(mockApiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(mockSerializedJson);
      req.flush(null, { status: 200, statusText: 'OK' });

      await storePromise;

      expect(mockSerialize).toHaveBeenCalledWith(mockPublicKeys);

      const p2 = service.getKey(mockUserUrn);
      const req2 = httpMock.expectOne(mockApiUrl);
      expect(req2.request.method).toBe('GET');
      req2.flush(mockJsonResponse, { status: 200, statusText: 'OK' });
      await p2;
    });
  });
});
