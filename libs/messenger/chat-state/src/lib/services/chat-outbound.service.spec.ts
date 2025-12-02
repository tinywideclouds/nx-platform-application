// libs/messenger/chat-state/src/lib/services/chat-outbound.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { ChatOutboundService } from './chat-outbound.service';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MockProvider } from 'ng-mocks';

// Services
import { ChatSendService } from '@nx-platform-application/chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { Logger } from '@nx-platform-application/console-logger';
import { ContactMessengerMapper } from './contact-messenger.mapper';

describe('ChatOutboundService', () => {
  let service: ChatOutboundService;
  let storageService: ChatStorageService;
  let sendService: ChatSendService;
  let cryptoService: MessengerCryptoService;

  // --- Fixtures ---
  const myUrn = URN.parse('urn:auth:user:me');
  const contactUrn = URN.parse('urn:contacts:user:bob');
  const handleUrn = URN.parse('urn:lookup:email:bob@test.com');
  const typeId = URN.parse('urn:message:type:text');
  const payloadBytes = new Uint8Array([1, 2, 3]);

  // Mock Envelope returned by crypto service
  const mockSignedEnvelope = {
    recipientId: handleUrn,
    encryptedData: new Uint8Array([]),
    signature: new Uint8Array([9]),
    isEphemeral: false, // Default state from crypto
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatOutboundService,
        MockProvider(ChatSendService, {
          sendMessage: vi.fn().mockReturnValue(of(undefined)),
        }),
        MockProvider(MessengerCryptoService, {
          encryptAndSign: vi.fn().mockResolvedValue({ ...mockSignedEnvelope }), // Return copy
        }),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(KeyCacheService, {
          getPublicKey: vi.fn().mockResolvedValue({}),
        }),
        MockProvider(ContactMessengerMapper, {
          resolveToHandle: vi.fn().mockResolvedValue(handleUrn),
          getStorageUrn: vi.fn().mockResolvedValue(contactUrn),
        }),
        MockProvider(Logger),
      ],
    });
    service = TestBed.inject(ChatOutboundService);
    storageService = TestBed.inject(ChatStorageService);
    sendService = TestBed.inject(ChatSendService);
    cryptoService = TestBed.inject(MessengerCryptoService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save OPTIMISTICALLY (pending) -> Send -> Save (sent) for normal messages', async () => {
    await service.send({} as any, myUrn, contactUrn, typeId, payloadBytes);

    // 1. Verify Sequence: Expect 2 saves (Pending, then Sent)
    expect(storageService.saveMessage).toHaveBeenCalledTimes(2);

    // 2. Verify First Save (Pending)
    const firstCall = (storageService.saveMessage as any).mock.calls[0][0];
    expect(firstCall).toEqual(
      expect.objectContaining({
        status: 'pending',
        conversationUrn: contactUrn,
      })
    );

    // 3. Verify Network Call
    expect(sendService.sendMessage).toHaveBeenCalled();

    // 4. Verify Second Save (Sent)
    const secondCall = (storageService.saveMessage as any).mock.calls[1][0];
    expect(secondCall).toEqual(
      expect.objectContaining({
        messageId: firstCall.messageId, // Must match
        status: 'sent',
      })
    );
  });

  it('should leave message as PENDING if network fails', async () => {
    // Override the default mock to throw
    vi.spyOn(sendService, 'sendMessage').mockReturnValue(
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
    expect(storageService.saveMessage).toHaveBeenCalledTimes(1);
    expect(storageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' })
    );

    // Should catch error and return the optimistic object (so UI shows pending state)
    expect(result).toBeTruthy();
    expect(result?.status).toBe('pending');
  });

  it('should SKIP storage and SET flag for Ephemeral messages', async () => {
    // Act: Send with isEphemeral = true
    await service.send({} as any, myUrn, contactUrn, typeId, payloadBytes, {
      isEphemeral: true,
    });

    // 1. Storage should NOT be called
    expect(storageService.saveMessage).not.toHaveBeenCalled();

    // 2. Verify Network Call contained the flag
    expect(sendService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        isEphemeral: true, // ✅ Key Assertion
      })
    );
  });

  it('should not fail if ephemeral sending fails', async () => {
    vi.spyOn(sendService, 'sendMessage').mockReturnValue(
      of(null).pipe(() => {
        throw new Error('Net Error');
      })
    );

    const result = await service.send(
      {} as any,
      myUrn,
      contactUrn,
      typeId,
      payloadBytes,
      { isEphemeral: true }
    );

    expect(storageService.saveMessage).not.toHaveBeenCalled();
    // Should return null (failure handled gracefully)
    expect(result).toBeNull();
  });
});
