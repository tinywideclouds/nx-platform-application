import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { Mock, vi } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

import { ChatDataService } from './chat-data.service';

// --- Mock platform-types ---
// Mock the "queue" facade helpers
vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    deserializeJsonToQueuedMessages: vi.fn(),
    // We also mock the types/helpers we *don't* use anymore
    // to ensure the service isn't importing them.
    serializeEnvelopeToJson: vi.fn(),
    deserializeJsonToEnvelopes: vi.fn(),
  };
});

import {
  QueuedMessage,
  SecureEnvelope,
  deserializeJsonToQueuedMessages,
} from '@nx-platform-application/platform-types';
// --- End Mock ---

// --- Mock Data ---
const mockSmartEnvelope: SecureEnvelope = {
  recipientId: URN.parse('urn:contacts:user:test'),
  encryptedData: new Uint8Array([1]),
  encryptedSymmetricKey: new Uint8Array([2]),
  signature: new Uint8Array([3]),
};

const mockSmartQueuedMessages: QueuedMessage[] = [
  { id: 'ack-id-1', envelope: mockSmartEnvelope },
  { id: 'ack-id-2', envelope: mockSmartEnvelope },
];

// Raw JSON response from GET /api/messages
// --- THIS IS THE FIX ---
const mockMessagesJsonResponse: object = {
  // --- END FIX ---
  messages: [
    {
      id: 'ack-id-1',
      envelope: {
        /* ... */
      },
    },
  ],
};
const baseApiUrl = '/api/messages';

describe('ChatDataService (Refactored)', () => {
  let service: ChatDataService;
  let httpMock: HttpTestingController;

  let mockDeserialize: Mock;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatDataService],
    });
    service = TestBed.inject(ChatDataService);
    httpMock = TestBed.inject(HttpTestingController);

    // Assign mock
    const platformTypes = await import(
      '@nx-platform-application/platform-types'
    );
    mockDeserialize = platformTypes.deserializeJsonToQueuedMessages as Mock;

    // Reset mocks
    vi.clearAllMocks();

    // Default mock implementation
    mockDeserialize.mockReturnValue(mockSmartQueuedMessages);
  });

  afterEach(() => {
    httpMock.verify(); // Ensures no outstanding HTTP requests
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getMessageBatch', () => {
    it('should GET the messages endpoint with limit and deserialize the response', async () => {
      const limit = 25;
      const promise = firstValueFrom(service.getMessageBatch(limit));

      // Verify the HTTP call
      const req = httpMock.expectOne(
        (r) => r.url === baseApiUrl && r.params.has('limit')
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('limit')).toBe(limit.toString());
      req.flush(mockMessagesJsonResponse); // Return the raw JSON

      // Verify the result
      const result = await promise;

      // Check that the raw JSON was passed to the deserializer
      expect(mockDeserialize).toHaveBeenCalledWith(mockMessagesJsonResponse);
      // Check that the final result is the "smart" model array
      expect(result).toEqual(mockSmartQueuedMessages);
    });
  });

  describe('acknowledge', () => {
    it('should POST the message ID array to the ack endpoint', async () => {
      const mockIds = ['ack-id-1', 'ack-id-2'];
      const ackUrl = `${baseApiUrl}/ack`;
      const promise = firstValueFrom(service.acknowledge(mockIds));

      // Verify the HTTP call
      const req = httpMock.expectOne(ackUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ messageIds: mockIds });
      req.flush(null, { status: 204, statusText: 'No Content' });

      // Verify the result (should be void)
      await promise;
      expect(true).toBe(true); // Reached end of promise
    });
  });
});
