import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { Mock, vi } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

import { ChatDataService } from './chat-data.service';

// --- Mock messenger-types ---
vi.mock('@nx-platform-application/messenger-types', async () => ({
  serializeEnvelopeToJson: vi.fn(),
  deserializeJsonToEnvelopes: vi.fn(),
}));

import {
  SecureEnvelope,
  serializeEnvelopeToJson,
  deserializeJsonToEnvelopes,
} from '@nx-platform-application/messenger-types';
// --- End Mock ---


// --- Mock Data ---
const mockSmartEnvelope: SecureEnvelope = {
  senderId: URN.parse('urn:sm:user:123'),
  recipientId: URN.parse('urn:sm:user:456'),
  messageId: 'msg-123',
  encryptedData: new Uint8Array([1]),
  encryptedSymmetricKey: new Uint8Array([2]),
  signature: new Uint8Array([3]),
};

const mockUser = URN.parse('urn:sm:user:456');
const mockJsonString = '{"senderId":"urn:sm:user:123"}';
const mockJsonResponse = { envelopes: [{ senderId: 'urn:sm:user:123' }] };

describe('ChatDataService', () => {
  let service: ChatDataService;
  let httpMock: HttpTestingController;

  // Define URLs
  const sendUrl = '/api/messages/send';
  const receiveUrl = `/api/messages/receive/${mockUser.toString()}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatDataService],
    });
    service = TestBed.inject(ChatDataService);
    httpMock = TestBed.inject(HttpTestingController);

    // Reset mocks
    vi.clearAllMocks();

    // Setup mock implementations
    (serializeEnvelopeToJson as Mock).mockReturnValue(mockJsonString);
    (deserializeJsonToEnvelopes as Mock).mockReturnValue([mockSmartEnvelope]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('fetchMessages', () => {
    // Corrected test with async/await
    it('should GET, deserialize, and return smart envelopes', async () => {
      // 1. Get a promise *before* flushing
      const promise = firstValueFrom(service.fetchMessages());

      // 2. Expect the HTTP call and flush
      const req = httpMock.expectOne(receiveUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockJsonResponse);

      // 3. Await the promise
      const envelopes = await promise;

      // 4. Run assertions
      expect(envelopes).toEqual([mockSmartEnvelope]);
      expect(deserializeJsonToEnvelopes).toHaveBeenCalledWith(mockJsonResponse);
    });
  });

  describe('postMessage', () => {
    // Corrected test with async/await
    it('should serialize and POST a JSON string', async () => {
      // 1. Get a promise *before* flushing
      const promise = firstValueFrom(service.postMessage(mockSmartEnvelope));

      // 2. Verify the serializer was called
      expect(serializeEnvelopeToJson).toHaveBeenCalledWith(mockSmartEnvelope);

      // 3. Expect the HTTP call and flush
      const req = httpMock.expectOne(sendUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      expect(req.request.body).toBe(mockJsonString);

      req.flush(null, { status: 201, statusText: 'Created' });

      // 4. Await the promise to ensure it completes
      await promise;
    });
  });
});
