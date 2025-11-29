import { TestBed } from '@angular/core/testing';
import { ChatOutboundService } from './chat-outbound.service';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  // --- Fixtures ---
  const myUrn = URN.parse('urn:auth:user:me');
  const contactUrn = URN.parse('urn:sm:user:bob');
  const handleUrn = URN.parse('urn:lookup:email:bob@test.com');
  const typeId = URN.parse('urn:sm:type:text');
  const payloadBytes = new Uint8Array([1, 2, 3]);

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatOutboundService,
        MockProvider(ChatSendService, {
          sendMessage: vi.fn().mockReturnValue(of(undefined)),
        }),
        MockProvider(MessengerCryptoService, {
          encryptAndSign: vi
            .fn()
            .mockResolvedValue({ signature: new Uint8Array([9]) }),
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save OPTIMISTICALLY (pending) -> Send -> Save (sent)', async () => {
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

    // Should catch error and return null
    expect(result).toBeNull();
  });
});
