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
import { ContactMessengerMapper } from './contact-messenger.mapper';

// Mocks
const mockSendService = { sendMessage: vi.fn().mockReturnValue(of(undefined)) };
const mockCryptoService = { encryptAndSign: vi.fn() };
const mockStorageService = { saveMessage: vi.fn() };
const mockKeyCache = { getPublicKey: vi.fn() };
const mockLogger = { error: vi.fn() };

// Mock Mapper
const mockMapper = {
  resolveToHandle: vi.fn(),
  getStorageUrn: vi.fn(),
};

describe('ChatOutboundService', () => {
  let service: ChatOutboundService;

  const myUrn = URN.parse('urn:auth:user:me');
  const contactUrn = URN.parse('urn:sm:user:bob');
  const handleUrn = URN.parse('urn:lookup:email:bob@test.com');

  const typeId = URN.parse('urn:sm:type:text');
  const payloadBytes = new Uint8Array([1, 2, 3]);
  const mockEnvelope = { signature: new Uint8Array([9]) };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default Behaviors
    mockMapper.resolveToHandle.mockResolvedValue(handleUrn); // UI -> Network
    mockMapper.getStorageUrn.mockResolvedValue(contactUrn); // UI <- Storage
    
    mockKeyCache.getPublicKey.mockResolvedValue({});
    mockCryptoService.encryptAndSign.mockResolvedValue(mockEnvelope);

    TestBed.configureTestingModule({
      providers: [
        ChatOutboundService,
        { provide: ChatSendService, useValue: mockSendService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: KeyCacheService, useValue: mockKeyCache },
        { provide: ContactMessengerMapper, useValue: mockMapper },
        { provide: Logger, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(ChatOutboundService);
  });

  it('should resolve handle for encryption but use contact for storage', async () => {
    const result = await service.send(
      {} as any,
      myUrn,
      contactUrn,
      typeId,
      payloadBytes
    );

    // 1. Verify Resolution
    expect(mockMapper.resolveToHandle).toHaveBeenCalledWith(contactUrn);

    // 2. Verify Encryption uses Routing URN (Handle)
    expect(mockKeyCache.getPublicKey).toHaveBeenCalledWith(handleUrn);
    expect(mockCryptoService.encryptAndSign).toHaveBeenCalledWith(
      expect.anything(),
      handleUrn, 
      expect.anything(),
      expect.anything()
    );

    // 3. Verify Storage uses Storage URN (Contact)
    // This ensures the message appears in the current UI thread
    expect(mockMapper.getStorageUrn).toHaveBeenCalledWith(contactUrn);
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationUrn: contactUrn,
      })
    );

    expect(result).toBeTruthy();
  });

  it('should fail gracefully if mapper throws', async () => {
    mockMapper.resolveToHandle.mockRejectedValue(new Error('Resolution Failed'));

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