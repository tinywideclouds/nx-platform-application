//libs/messenger/infrastructure/chat-access/src/lib/chat-send.service.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { Mock, vi } from 'vitest';
import { URN, SecureEnvelope } from '@nx-platform-application/platform-types';
import { ChatSendService } from './chat-send.service';

vi.mock('@nx-platform-application/platform-types', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    serializeEnvelopeToJson: vi.fn(),
    deserializeJsonToQueuedMessages: vi.fn(),
    deserializeJsonToEnvelopes: vi.fn(),
  };
});

const mockSmartEnvelope: SecureEnvelope = {
  recipientId: URN.parse('urn:contacts:user:recipient'),
  encryptedData: new Uint8Array([1]),
  encryptedSymmetricKey: new Uint8Array([2]),
  signature: new Uint8Array([3]),
};

const mockJsonPayload =
  '{"recipientId":"urn:contacts:user:recipient","encryptedData":"AQ==","encryptedSymmetricKey":"Ag==","signature":"Aw=="}';

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

    const platformTypes =
      await import('@nx-platform-application/platform-types');
    mockSerialize = platformTypes.serializeEnvelopeToJson as Mock;

    vi.clearAllMocks();
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

      const req = httpMock.expectOne(sendUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(mockJsonPayload);
      expect(req.request.headers.get('Content-Type')).toBe('application/json');

      req.flush(null, { status: 202, statusText: 'Accepted' });

      await promise;

      expect(mockSerialize).toHaveBeenCalledWith(mockSmartEnvelope);
    });
  });
});
