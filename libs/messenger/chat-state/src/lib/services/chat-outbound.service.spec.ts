// libs/messenger/chat-state/src/lib/services/chat-outbound.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { ChatOutboundService } from './chat-outbound.service';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi } from 'vitest';

// Services
import { ChatSendService } from '@nx-platform-application/chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatKeyService } from './chat-key.service'; // <--- NEW IMPORT

// Mocks
const mockSendService = { sendMessage: vi.fn().mockReturnValue(of(undefined)) };
const mockCryptoService = { encryptAndSign: vi.fn() };
const mockStorageService = { saveMessage: vi.fn() };
const mockKeyCache = { getPublicKey: vi.fn() };
const mockLogger = { error: vi.fn() };

// Mock the Key Logic Worker
const mockKeyLogic = {
  resolveRecipientIdentity: vi.fn(),
};

describe('ChatOutboundService', () => {
  let service: ChatOutboundService;

  const myUrn = URN.parse('urn:auth:user:me');
  const contactUrn = URN.parse('urn:sm:user:bob');
  const resolvedAuthUrn = URN.parse('urn:lookup:email:bob@test.com');

  const typeId = URN.parse('urn:sm:type:text');
  const payloadBytes = new Uint8Array([1, 2, 3]);
  const mockEnvelope = { signature: new Uint8Array([9]) };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default Behaviors
    mockKeyLogic.resolveRecipientIdentity.mockResolvedValue(resolvedAuthUrn);
    mockKeyCache.getPublicKey.mockResolvedValue({});
    mockCryptoService.encryptAndSign.mockResolvedValue(mockEnvelope);

    TestBed.configureTestingModule({
      providers: [
        ChatOutboundService,
        { provide: ChatSendService, useValue: mockSendService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: KeyCacheService, useValue: mockKeyCache },
        { provide: ChatKeyService, useValue: mockKeyLogic }, // <--- MOCK PROVIDED
        { provide: Logger, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(ChatOutboundService);
  });

  it('should resolve identity via ChatKeyService before encrypting', async () => {
    const result = await service.send(
      {} as any,
      myUrn,
      contactUrn,
      typeId,
      payloadBytes
    );

    // 1. Verify Delegation
    expect(mockKeyLogic.resolveRecipientIdentity).toHaveBeenCalledWith(
      contactUrn
    );

    // 2. Verify Encryption uses the RESOLVED URN (not the contact URN)
    expect(mockKeyCache.getPublicKey).toHaveBeenCalledWith(resolvedAuthUrn);
    expect(mockCryptoService.encryptAndSign).toHaveBeenCalledWith(
      expect.anything(),
      resolvedAuthUrn, // <--- Important check
      expect.anything(),
      expect.anything()
    );

    // 3. Verify Storage preserves the ORIGINAL Contact URN (for UI grouping)
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: contactUrn,
      })
    );

    expect(result).toBeTruthy();
  });

  it('should fail gracefully if resolution fails', async () => {
    mockKeyLogic.resolveRecipientIdentity.mockRejectedValue(
      new Error('Resolution Failed')
    );

    const result = await service.send(
      {} as any,
      myUrn,
      contactUrn,
      typeId,
      payloadBytes
    );

    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockSendService.sendMessage).not.toHaveBeenCalled();
  });
});
