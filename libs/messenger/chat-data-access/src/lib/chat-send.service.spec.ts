import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { Mock, vi } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

// --- Service Under Test ---
import { ChatSendService } from './chat-send.service';

// --- Mock platform-types ---
vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    serializeEnvelopeToJson: vi.fn(),
    // Mock the other facades to ensure this service doesn't import them
    deserializeJsonToQueuedMessages: vi.fn(),
    deserializeJsonToEnvelopes: vi.fn(),
  };
});

import {
  SecureEnvelope,
} from '@nx-platform-application/platform-types';
// --- End Mock ---

// --- Mock Data ---
const mockSmartEnvelope: SecureEnvelope = {
  recipientId: URN.parse('urn:sm:user:recipient'),
  encryptedData: new Uint8Array([1]),
  encryptedSymmetricKey: new Uint8Array([2]),
  signature: new Uint8Array([3]),
};

// The raw string returned by the serializer
const mockJsonPayload =
  '{"recipientId":"urn:sm:user:recipient","encryptedData":"AQ==","encryptedSymmetricKey":"Ag==","signature":"Aw=="}';

const sendUrl = '/api/send';

describe('ChatSendService', () => {
  let service: ChatSendService;
  let httpMock: HttpTestingController;
  let mockSerialize: Mock;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatSendService],
    });
    service = TestBed.inject(ChatSendService);
    httpMock = TestBed.inject(HttpTestingController);

    // Assign mock
    const platformTypes = await import('@nx-platform-application/platform-types');
    mockSerialize = platformTypes.serializeEnvelopeToJson as Mock;

    // Reset mocks
    vi.clearAllMocks();

    // Default mock implementation
    mockSerialize.mockReturnValue(mockJsonPayload);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('sendMessage', () => {
    it('should serialize the envelope and POST the raw JSON string', async () => {
      const promise = firstValueFrom(service.sendMessage(mockSmartEnvelope));

      // Verify the HTTP call
      const req = httpMock.expectOne(sendUrl);
      expect(req.request.method).toBe('POST');
      // Verify the body is the raw string
      expect(req.request.body).toBe(mockJsonPayload);
      // Verify the content type header is set
      expect(req.request.headers.get('Content-Type')).toBe('application/json');

      // Respond with 202 Accepted
      req.flush(null, { status: 202, statusText: 'Accepted' });

      // Verify the result (should be void)
      await promise;

      // Check that the "smart" envelope was passed to the serializer
      expect(mockSerialize).toHaveBeenCalledWith(mockSmartEnvelope);
    });
  });
});
