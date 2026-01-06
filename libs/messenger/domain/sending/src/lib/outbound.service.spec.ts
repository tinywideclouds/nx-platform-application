import { TestBed } from '@angular/core/testing';
import { OutboundService } from './outbound.service';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { Logger } from '@nx-platform-application/console-logger';
import { DirectSendStrategy } from './strategies/direct-send.strategy';
import { NetworkGroupStrategy } from './strategies/group-network.strategy';
import { LocalBroadcastStrategy } from './strategies/group-broadcast.strategy';
import { OutboundResult } from './outbound.service';

describe('OutboundService', () => {
  let service: OutboundService;
  let outboxWorker: OutboxWorkerService;
  let directStrategy: DirectSendStrategy;
  let storageService: ChatStorageService;

  const myUrn = URN.parse('urn:contacts:user:me');
  const recipientUrn = URN.parse('urn:contacts:user:bob');
  const typeId = URN.parse('urn:message:type:text');
  const payload = new Uint8Array([]);
  const keys = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        OutboundService,
        MockProvider(Logger),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(IdentityResolver, {
          getStorageUrn: vi.fn().mockResolvedValue(recipientUrn),
        }),
        MockProvider(OutboxWorkerService, {
          processQueue: vi.fn(),
        }),
        MockProvider(DirectSendStrategy, { send: vi.fn() }),
        MockProvider(NetworkGroupStrategy, { send: vi.fn() }),
        MockProvider(LocalBroadcastStrategy, { send: vi.fn() }),
      ],
    });

    service = TestBed.inject(OutboundService);
    outboxWorker = TestBed.inject(OutboxWorkerService);
    directStrategy = TestBed.inject(DirectSendStrategy);
    storageService = TestBed.inject(ChatStorageService);
  });

  it('should delegate to strategy and then trigger worker only AFTER outcome resolves', async () => {
    let outcomeResolved = false;

    const outcomePromise = new Promise<any>((resolve) => {
      setTimeout(() => {
        outcomeResolved = true;
        resolve('pending');
      }, 50);
    });

    const mockResult: OutboundResult = {
      message: {} as any,
      outcome: outcomePromise,
    };

    vi.spyOn(directStrategy, 'send').mockResolvedValue(mockResult);

    const call = service.sendMessage(
      keys,
      myUrn,
      recipientUrn,
      typeId,
      payload,
      {
        isEphemeral: false,
      },
    );

    expect(outboxWorker.processQueue).not.toHaveBeenCalled();

    await call;

    expect(outcomeResolved).toBe(true);
    expect(outboxWorker.processQueue).toHaveBeenCalledWith(myUrn, keys);
  });

  it('should NOT save locally in the service (Delegated to Strategy)', async () => {
    const mockResult: OutboundResult = {
      message: {} as any,
      outcome: Promise.resolve('sent'),
    };

    vi.spyOn(directStrategy, 'send').mockResolvedValue(mockResult);

    await service.sendMessage(keys, myUrn, recipientUrn, typeId, payload);

    // ✅ Verified: Service no longer saves. Strategy owns this.
    expect(storageService.saveMessage).not.toHaveBeenCalled();
  });
});
