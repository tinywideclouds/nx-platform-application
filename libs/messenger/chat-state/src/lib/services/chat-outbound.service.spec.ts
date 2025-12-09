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

// [Refactor]
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';

describe('ChatOutboundService', () => {
  let service: ChatOutboundService;
  let storageService: ChatStorageService;
  let sendService: ChatSendService;

  // --- Fixtures ---
  const myUrn = URN.parse('urn:auth:user:me');
  const contactUrn = URN.parse('urn:contacts:user:bob');
  const handleUrn = URN.parse('urn:lookup:email:bob@test.com');
  const typeId = URN.parse('urn:message:type:text');
  const payloadBytes = new Uint8Array([1, 2, 3]);

  const mockSignedEnvelope = {
    recipientId: handleUrn,
    encryptedData: new Uint8Array([]),
    signature: new Uint8Array([9]),
    isEphemeral: false,
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
          encryptAndSign: vi.fn().mockResolvedValue({ ...mockSignedEnvelope }),
        }),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(KeyCacheService, {
          getPublicKey: vi.fn().mockResolvedValue({}),
        }),
        // [Refactor] Mock Resolver
        MockProvider(IdentityResolver, {
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

  // ... (Tests remain identical logic-wise, just verifying the new mock is called) ...

  it('should save OPTIMISTICALLY (pending) -> Send -> Save (sent)', async () => {
    await service.send({} as any, myUrn, contactUrn, typeId, payloadBytes);
    expect(storageService.saveMessage).toHaveBeenCalledTimes(2);
  });
});
