import { TestBed } from '@angular/core/testing';
import { HotQueueMonitor } from './hot-queue-monitor.service';
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
// ✅ NEW IMPORT
import { MessageSecurityService } from '@nx-platform-application/messenger-infrastructure-message-security';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MessageTypeDeviceSync } from '@nx-platform-application/messenger-domain-message-content';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('HotQueueSpy', () => {
  let service: HotQueueMonitor;

  const mockDataService = {
    getMessageBatch: vi.fn(),
  };

  // ✅ Mock the Security Service
  const mockSecurity = {
    decryptSyncMessage: vi.fn(),
    decryptSyncOffer: vi.fn(),
  };

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };

  const myUrn = URN.parse('urn:contacts:user:1');

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        HotQueueMonitor,
        { provide: ChatDataService, useValue: mockDataService },
        // ✅ Provide the mock here
        { provide: MessageSecurityService, useValue: mockSecurity },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(HotQueueMonitor);
  });

  it('should return NULL if queue is empty', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([]));
    const result = await service.checkQueueForInvite({} as CryptoKey, myUrn);
    expect(result).toBeNull();
  });

  it('should skip messages that fail decryption (wrong key)', async () => {
    mockDataService.getMessageBatch.mockReturnValue(
      of([{ id: 'msg-1', envelope: {} }]),
    );
    mockSecurity.decryptSyncMessage.mockRejectedValue(
      new Error('Decrypt fail'),
    );

    const rsaKey = { algorithm: { name: 'RSA-OAEP' } } as any;
    const result = await service.checkQueueForInvite(rsaKey, myUrn);

    expect(result).toBeNull();
    // Should swallow error and log debug
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Decryption failed'),
      expect.any(Error),
    );
  });

  it('should return payload when Valid Invite is found', async () => {
    mockDataService.getMessageBatch.mockReturnValue(
      of([{ id: 'msg-1', envelope: {} }]),
    );

    const validPayload = {
      typeId: MessageTypeDeviceSync,
      payloadBytes: new Uint8Array([1]),
    };

    mockSecurity.decryptSyncMessage.mockResolvedValue(validPayload);

    const rsaKey = { algorithm: { name: 'RSA-OAEP' } } as any;
    const result = await service.checkQueueForInvite(rsaKey, myUrn);

    expect(result).toEqual(validPayload);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Trojan Horse Found'),
    );
  });

  it('should use decryptSyncOffer for AES keys', async () => {
    mockDataService.getMessageBatch.mockReturnValue(
      of([{ id: 'msg-1', envelope: {} }]),
    );

    const validPayload = {
      typeId: MessageTypeDeviceSync,
      payloadBytes: new Uint8Array([1]),
    };

    mockSecurity.decryptSyncOffer.mockResolvedValue(validPayload);

    const aesKey = { algorithm: { name: 'AES-GCM' } } as any;
    await service.checkQueueForInvite(aesKey, myUrn);

    // Verify it called the AES method, not the RSA one
    expect(mockSecurity.decryptSyncOffer).toHaveBeenCalled();
    expect(mockSecurity.decryptSyncMessage).not.toHaveBeenCalled();
  });
});
