//libs/messenger/infrastructure/chat-access/src/lib/chat-data.service.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { Mock, vi } from 'vitest';
import {
  URN,
  QueuedMessage,
  SecureEnvelope,
} from '@nx-platform-application/platform-types';
import { ChatDataService } from './chat-data.service';

vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    deserializeJsonToQueuedMessages: vi.fn(),
    serializeEnvelopeToJson: vi.fn(),
    deserializeJsonToEnvelopes: vi.fn(),
  };
});

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

const mockMessagesJsonResponse = {
  messages: [
    {
      id: 'ack-id-1',
      envelope: {},
    },
  ],
};
const baseApiUrl = '/api/messages';

describe('ChatDataService', () => {
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

    const platformTypes =
      await import('@nx-platform-application/platform-types');
    mockDeserialize = platformTypes.deserializeJsonToQueuedMessages as Mock;

    vi.clearAllMocks();
    mockDeserialize.mockReturnValue(mockSmartQueuedMessages);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getMessageBatch', () => {
    it('should GET the messages endpoint with limit and deserialize the response', async () => {
      const limit = 25;
      const promise = firstValueFrom(service.getMessageBatch(limit));

      const req = httpMock.expectOne(
        (r) => r.url === baseApiUrl && r.params.has('limit'),
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('limit')).toBe(limit.toString());
      req.flush(mockMessagesJsonResponse);

      const result = await promise;

      expect(mockDeserialize).toHaveBeenCalledWith(mockMessagesJsonResponse);
      expect(result).toEqual(mockSmartQueuedMessages);
    });
  });

  describe('getAllMessages (Drain)', () => {
    it('should recursively fetch pages until a partial batch is returned', async () => {
      // 1. Setup Mock Data
      // Batch 1: Full (50 items)
      const batch1 = Array(50).fill(mockSmartQueuedMessages[0]);
      // Batch 2: Partial (10 items) -> Should stop here
      const batch2 = Array(10).fill(mockSmartQueuedMessages[0]);

      mockDeserialize
        .mockReturnValueOnce(batch1) // First call
        .mockReturnValueOnce(batch2); // Second call

      // 2. Call the Drain Method
      const stream$ = service.getAllMessages();
      const resultPromise = firstValueFrom(stream$.pipe(toArray()));

      // 3. Handle Request 1 (Expect 50)
      const req1 = httpMock.expectOne(
        (r) =>
          r.url === `${baseApiUrl}/messages` && r.params.get('limit') === '50',
      );
      req1.flush({ messages: [] }); // Payload doesn't matter, mockDeserialize controls return

      // 4. Handle Request 2 (Expect 50 again due to recursion)
      const req2 = httpMock.expectOne(
        (r) =>
          r.url === `${baseApiUrl}/messages` && r.params.get('limit') === '50',
      );
      req2.flush({ messages: [] });

      // 5. Verify Results
      const allBatches = await resultPromise;
      expect(allBatches.length).toBe(2); // Should have emitted twice
      expect(allBatches[0]).toEqual(batch1);
      expect(allBatches[1]).toEqual(batch2);
    });
  });

  describe('acknowledge', () => {
    it('should POST the message ID array to the ack endpoint', async () => {
      const mockIds = ['ack-id-1', 'ack-id-2'];
      const ackUrl = `${baseApiUrl}/ack`;
      const promise = firstValueFrom(service.acknowledge(mockIds));

      const req = httpMock.expectOne(ackUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ messageIds: mockIds });
      req.flush(null, { status: 204, statusText: 'No Content' });

      await promise;
    });
  });
});
