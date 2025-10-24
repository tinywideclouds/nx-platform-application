import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { URN } from '@nx-platform-application/platform-types';

import { KeyService } from './key.service';
import { PublicKeys } from './public-keys.model';

describe('KeyService', () => {
  let service: KeyService;
  let httpMock: HttpTestingController;

  const mockUserUrn: URN = URN.create('user', '123');
  const mockUserString = 'urn:sm:user:123';

  // This is the raw blob the Go service sends/receives
  const mockRawKeyBlob = new Uint8Array([1, 2, 3, 4, 5]);
  const mockBuffer = mockRawKeyBlob.buffer;

  // This is the "nice object" the app uses
  const mockNiceKeys: PublicKeys = {
    encKey: mockRawKeyBlob,
    sigKey: new Uint8Array(), // Empty, as per our logic
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [KeyService],
    });
    service = TestBed.inject(KeyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getKey', () => {
    it('should fetch a raw blob and return a "nice" PublicKeys object', async () => {
      const promise = service.getKey(mockUserUrn);

      const req = httpMock.expectOne(`/api/keys/${mockUserString}`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('arraybuffer');

      // Respond with the raw blob
      req.flush(mockBuffer);

      // Assert the service returns the "wrapped" nice object
      const keys = await promise;
      expect(keys).toEqual(mockNiceKeys);
    });

    it('should return the cached "nice" object on second call', async () => {
      // --- First Call ---
      const promise1 = service.getKey(mockUserUrn);
      httpMock.expectOne(`/api/keys/${mockUserString}`).flush(mockBuffer);
      await promise1; // Wait for cache to be populated

      // --- Second Call ---
      const promise2 = service.getKey(mockUserUrn);
      const keys2 = await promise2;

      httpMock.expectNone(`/api/keys/${mockUserString}`); // Prove cache was used
      expect(keys2).toEqual(mockNiceKeys);
    });
  });

  describe('setKey', () => {
    it('should POST *only* the encKey blob to the store', async () => {
      // Create a "nice" object that includes an *ignored* sigKey
      const newNiceKeys: PublicKeys = {
        encKey: new Uint8Array([10, 20, 30]),
        sigKey: new Uint8Array([9, 8, 7]), // This should be ignored
      };

      const expectedBlob = newNiceKeys.encKey;

      const promise = service.setKey(mockUserUrn, newNiceKeys);

      const req = httpMock.expectOne(`/api/keys/${mockUserString}`);
      expect(req.request.method).toBe('POST');
      // Assert the body is the raw ArrayBuffer of *only* the encKey
      expect(req.request.body).toEqual(expectedBlob.buffer);
      expect(req.request.headers.get('Content-Type')).toBe('application/octet-stream');

      req.flush(null, { status: 201, statusText: 'Created' });
      await promise;
    });

    it('should update the cache on a successful setKey', async () => {
      const promise = service.setKey(mockUserUrn, mockNiceKeys);
      // httpMock.expectOne(`/api/keys/${mockUserString}`).flush(null, { status: 201 });
      httpMock.expectOne(`/api/keys/${mockUserString}`).flush(null, {
        status: 201,
        statusText: 'Created' // Or "OK", etc.
      });
      await promise;

      // Now, call getKey and expect it to hit the cache
      const key = await service.getKey(mockUserUrn);
      httpMock.expectNone(`/api/keys/${mockUserString}`);
      expect(key).toEqual(mockNiceKeys);
    });
  });
});
