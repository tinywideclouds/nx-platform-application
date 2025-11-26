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

describe('ChatOutboundService', () => {
  let service: ChatOutboundService;

  // --- Mocks ---
  const mockSendService = {
    sendMessage: vi.fn().mockReturnValue(of(undefined)),
  };
  const mockCryptoService = {
    encryptAndSign: vi
      .fn()
      .mockResolvedValue({ signature: new Uint8Array([9]) }),
  };
  const mockStorageService = {
    saveMessage: vi.fn().mockResolvedValue(undefined),
  };
  const mockKeyCache = {
    getPublicKey: vi.fn().mockResolvedValue({}),
  };
  const mockMapper = {
    resolveToHandle: vi.fn(),
    getStorageUrn: vi.fn(),
  };
  const mockLogger = { error: vi.fn() };

  // --- Fixtures ---
  const myUrn = URN.parse('urn:auth:user:me');
  const contactUrn = URN.parse('urn:sm:user:bob');
  const handleUrn = URN.parse('urn:lookup:email:bob@test.com');
  const typeId = URN.parse('urn:sm:type:text');
  const payloadBytes = new Uint8Array([1, 2, 3]);

  beforeEach(() => {
    vi.clearAllMocks();

    mockMapper.resolveToHandle.mockResolvedValue(handleUrn);
    mockMapper.getStorageUrn.mockResolvedValue(contactUrn);

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

  it('should save OPTIMISTICALLY (pending) -> Send -> Save (sent)', async () => {
    await service.send({} as any, myUrn, contactUrn, typeId, payloadBytes);

    // 1. Verify Sequence
    // Expect 2 saves (Pending, then Sent)
    expect(mockStorageService.saveMessage).toHaveBeenCalledTimes(2);

    // 2. Verify First Save (Pending)
    const firstCall = mockStorageService.saveMessage.mock.calls[0][0];
    expect(firstCall).toEqual(
      expect.objectContaining({
        status: 'pending',
        conversationUrn: contactUrn, // Using resolved storage URN
      })
    );

    // 3. Verify Network Call happened
    expect(mockSendService.sendMessage).toHaveBeenCalled();

    // 4. Verify Second Save (Sent)
    const secondCall = mockStorageService.saveMessage.mock.calls[1][0];
    expect(secondCall).toEqual(
      expect.objectContaining({
        messageId: firstCall.messageId, // Must be same ID
        status: 'sent',
      })
    );
  });

  it('should leave message as PENDING if network fails', async () => {
    mockSendService.sendMessage.mockReturnValue(
      of(null).pipe(() => {
        throw new Error('Network Error');
      })
    );

    const result = await service.send(
      {} as any,
      myUrn,
      contactUrn,
      typeId,
      payloadBytes
    );

    // Should have saved ONCE (Pending)
    expect(mockStorageService.saveMessage).toHaveBeenCalledTimes(1);
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' })
    );

    // Should catch error and return null
    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
