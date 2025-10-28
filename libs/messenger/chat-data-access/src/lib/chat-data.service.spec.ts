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
// Mock all the helpers this service uses
vi.mock('@nx-platform-application/messenger-types', async () => ({
  serializeEnvelopeToJson: vi.fn(),
  deserializeJsonToEnvelopes: vi.fn(),
  deserializeJsonToDigest: vi.fn(),
}));

import {
  SecureEnvelope,
  EncryptedDigest,
  serializeEnvelopeToJson,
  deserializeJsonToEnvelopes,
  deserializeJsonToDigest,
} from '@nx-platform-application/messenger-types';
// --- End Mock ---


// --- Mock Data ---
const mockSmartEnvelope: SecureEnvelope = { /* ... valid SecureEnvelope ... */ } as any;
const mockEncryptedDigest: EncryptedDigest = {
  items: [
    { conversationUrn: URN.parse('urn:sm:user:sender1'), encryptedSnippet: new Uint8Array([1, 1]) },
  ],
};
const mockConversationUrn = URN.parse('urn:sm:user:chatpartner');

// Payloads for API interaction
const mockJsonStringToSend = '{"senderId":"urn:sm:user:123"}';
const mockCountResponse = { hasNewMessages: true };
const mockDigestJsonResponse = { items: [{ conversationUrn: 'urn:sm:user:sender1', encryptedSnippet: 'AQE=' }] }; // Example raw JSON
const mockHistoryJsonResponse = { envelopes: [{ senderId: 'urn:sm:user:123' }] }; // Example raw JSON
const baseApiUrl = '/api/messages';

describe('ChatDataService', () => {
  let service: ChatDataService;
  let httpMock: HttpTestingController;

  // Define URLs based on the final API design
  const sendUrl = `${baseApiUrl}/send`;
  const countUrl = `${baseApiUrl}/count`;
  const digestUrl = `${baseApiUrl}/digest`;
  const historyUrl = `${baseApiUrl}/history/${mockConversationUrn.toString()}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatDataService],
    });
    service = TestBed.inject(ChatDataService);
    httpMock = TestBed.inject(HttpTestingController);

    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup mock implementations for serializers/deserializers
    (serializeEnvelopeToJson as Mock).mockReturnValue(mockJsonStringToSend);
    (deserializeJsonToEnvelopes as Mock).mockReturnValue([mockSmartEnvelope]);
    (deserializeJsonToDigest as Mock).mockReturnValue(mockEncryptedDigest);
  });

  afterEach(() => {
    httpMock.verify(); // Ensures no outstanding HTTP requests
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('postMessage', () => {
    it('should serialize the envelope and POST the JSON string', async () => {
      const promise = firstValueFrom(service.postMessage(mockSmartEnvelope));

      // Verify the serializer was called
      expect(serializeEnvelopeToJson).toHaveBeenCalledWith(mockSmartEnvelope);

      // Verify the HTTP call
      const req = httpMock.expectOne(sendUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      expect(req.request.body).toBe(mockJsonStringToSend); // Check body is the string
      req.flush(null, { status: 201, statusText: 'Created' });

      await promise; // Ensure completion
    });
  });

  describe('checkForNewMessages', () => {
    it('should GET the count endpoint and return the boolean response', async () => {
      const promise = firstValueFrom(service.checkForNewMessages());

      // Verify the HTTP call
      const req = httpMock.expectOne(countUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockCountResponse); // Return the mock JSON

      // Verify the result
      const result = await promise;
      expect(result).toEqual(mockCountResponse);
    });
  });

  describe('fetchMessageDigest', () => {
    it('should GET the digest endpoint and deserialize the JSON response', async () => {
      const promise = firstValueFrom(service.fetchMessageDigest());

      // Verify the HTTP call
      const req = httpMock.expectOne(digestUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockDigestJsonResponse); // Return the raw JSON

      // Verify the result
      const result = await promise;
      // Check that the raw JSON was passed to the deserializer
      expect(deserializeJsonToDigest).toHaveBeenCalledWith(mockDigestJsonResponse);
      // Check that the final result is the "smart" digest model
      expect(result).toEqual(mockEncryptedDigest);
    });
  });

  describe('fetchConversationHistory', () => {
    it('should GET the history endpoint and deserialize the JSON response', async () => {
      const promise = firstValueFrom(service.fetchConversationHistory(mockConversationUrn));

      // Verify the HTTP call
      const req = httpMock.expectOne(historyUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockHistoryJsonResponse); // Return the raw JSON

      // Verify the result
      const result = await promise;
      // Check that the raw JSON was passed to the deserializer
      expect(deserializeJsonToEnvelopes).toHaveBeenCalledWith(mockHistoryJsonResponse);
      // Check that the final result is the array of "smart" envelope models
      expect(result).toEqual([mockSmartEnvelope]);
    });
  });
});
