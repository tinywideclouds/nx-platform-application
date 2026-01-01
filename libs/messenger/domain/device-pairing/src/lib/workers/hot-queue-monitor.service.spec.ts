import { TestBed } from '@angular/core/testing';
import { HotQueueMonitor } from './hot-queue-monitor.service';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('HotQueueSpy', () => {
  let service: HotQueueMonitor;
  const mockDataService = { getMessageBatch: vi.fn() };
  const mockCryptoService = {
    decryptSyncMessage: vi.fn(),
    decryptSyncOffer: vi.fn(),
  };
  const mockLogger = { debug: vi.fn(), info: vi.fn() };

  const myUrn = URN.parse('urn:contacts:user:me');
  const mockSessionKey = { algorithm: { name: 'RSA-OAEP' } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        HotQueueMonitor,
        { provide: ChatDataService, useValue: mockDataService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: Logger, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(HotQueueMonitor);
  });

  it('should return NULL if queue is empty', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([]));
    const result = await service.checkQueueForInvite(mockSessionKey, myUrn);
    expect(result).toBeNull();
  });

  it('should skip messages that fail decryption (wrong key)', async () => {
    const batch = [
      { id: 'msg-1', envelope: {} },
      { id: 'msg-2', envelope: {} },
    ];
    mockDataService.getMessageBatch.mockReturnValue(of(batch));

    // Simulate all failing
    mockCryptoService.decryptSyncMessage.mockRejectedValue(
      new Error('Bad Key'),
    );

    const result = await service.checkQueueForInvite(mockSessionKey, myUrn);

    expect(result).toBeNull();
    // Should have tried both
    expect(mockCryptoService.decryptSyncMessage).toHaveBeenCalledTimes(2);
  });

  it('should return payload when Valid Invite is found', async () => {
    const batch = [{ id: 'msg-1', envelope: {} }];
    mockDataService.getMessageBatch.mockReturnValue(of(batch));

    const validPayload = {
      typeId: URN.parse('urn:message:type:device-sync'),
      payloadBytes: new Uint8Array([1, 2, 3]),
    };
    mockCryptoService.decryptSyncMessage.mockResolvedValue(validPayload);

    const result = await service.checkQueueForInvite(mockSessionKey, myUrn);

    expect(result).toEqual(validPayload);
  });

  it('should use decryptSyncOffer for AES keys', async () => {
    const aesKey = { algorithm: { name: 'AES-GCM' } } as any;
    mockDataService.getMessageBatch.mockReturnValue(of([{ envelope: {} }]));

    mockCryptoService.decryptSyncOffer.mockResolvedValue({
      typeId: URN.parse('urn:message:type:device-sync'),
    });

    await service.checkQueueForInvite(aesKey, myUrn);

    expect(mockCryptoService.decryptSyncOffer).toHaveBeenCalled();
  });
});
