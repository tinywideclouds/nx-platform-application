import { TestBed } from '@angular/core/testing';
import { ChatOutboundService } from './chat-outbound.service';
import {
  URN,
} from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi } from 'vitest';

// Services
import { ChatSendService } from '@nx-platform-application/chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-access';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-access';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { Logger } from '@nx-platform-application/console-logger';

// Mocks
const mockSendService = { sendMessage: vi.fn().mockReturnValue(of(undefined)) };
const mockCryptoService = { encryptAndSign: vi.fn() };
const mockStorageService = { saveMessage: vi.fn() };
const mockContactsService = { getLinkedIdentities: vi.fn() };
const mockKeyService = { getPublicKey: vi.fn() };
const mockLogger = { error: vi.fn() };

describe('ChatOutboundService', () => {
  let service: ChatOutboundService;

  // Valid 4-part URNs required by URN.parse()
  const myUrn = URN.parse('urn:auth:user:me');
  const contactUrn = URN.parse('urn:sm:user:bob');
  const authUrn = URN.parse('urn:auth:user:bob');
  
  const typeId = URN.parse('urn:sm:type:text');
  const payloadBytes = new Uint8Array([1, 2, 3]);
  const mockEnvelope = { signature: new Uint8Array([9]) };

  beforeEach(() => {
    vi.clearAllMocks();

    // Defaults
    mockContactsService.getLinkedIdentities.mockResolvedValue([authUrn]);
    mockKeyService.getPublicKey.mockResolvedValue({});
    mockCryptoService.encryptAndSign.mockResolvedValue(mockEnvelope);

    TestBed.configureTestingModule({
      providers: [
        ChatOutboundService,
        { provide: ChatSendService, useValue: mockSendService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: KeyCacheService, useValue: mockKeyService },
        { provide: Logger, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(ChatOutboundService);
  });

  it('should resolve identity, encrypt, send, and save', async () => {
    const result = await service.send(
      {} as any,
      myUrn,
      contactUrn,
      typeId,
      payloadBytes
    );

    // 1. Resolve Identity (Contact -> Auth)
    expect(mockContactsService.getLinkedIdentities).toHaveBeenCalledWith(
      contactUrn
    );
    expect(mockKeyService.getPublicKey).toHaveBeenCalledWith(authUrn);

    // 2. Encrypt (using resolved Auth URN)
    expect(mockCryptoService.encryptAndSign).toHaveBeenCalledWith(
      expect.objectContaining({ typeId }), 
      authUrn,
      expect.anything(),
      expect.anything()
    );

    // 3. Send
    expect(mockSendService.sendMessage).toHaveBeenCalledWith(mockEnvelope);

    // 4. Save (Optimistic message should preserve Contact URN for grouping)
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: myUrn,
        recipientId: contactUrn, // Preserved
        status: 'sent',
      })
    );

    expect(result).toBeTruthy();
  });

  it('should fail gracefully if crypto fails', async () => {
    mockCryptoService.encryptAndSign.mockRejectedValue(
      new Error('Crypto Fail')
    );

    const result = await service.send(
      {} as any,
      myUrn,
      contactUrn,
      typeId,
      payloadBytes
    );

    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send'),
      expect.any(Error)
    );
    expect(mockSendService.sendMessage).not.toHaveBeenCalled();
  });
});