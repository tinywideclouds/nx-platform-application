//libs/messenger/infrastructure/chat-access/src/lib/chat-data.service.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
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
