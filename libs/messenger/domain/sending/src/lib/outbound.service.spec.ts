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

  const myUrn = URN.parse('urn:contacts:user:me');
  const recipientUrn = URN.parse('urn:contacts:user:bob');
  const typeId = URN.parse('urn:message:type:text');
  const payload = new Uint8Array([]);
  const keys = {} as any;

  const mockResult: OutboundResult = {
    message: {} as any,
    outcome: Promise.resolve('pending'),
  };

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
        MockProvider(DirectSendStrategy, {
          send: vi.fn().mockResolvedValue(mockResult),
        }),
        MockProvider(NetworkGroupStrategy),
        MockProvider(LocalBroadcastStrategy),
      ],
    });

    service = TestBed.inject(OutboundService);
    outboxWorker = TestBed.inject(OutboxWorkerService);
    directStrategy = TestBed.inject(DirectSendStrategy);
  });

  it('should delegate to strategy and then trigger worker for persistent messages', async () => {
    await service.sendMessage(keys, myUrn, recipientUrn, typeId, payload, {
      isEphemeral: false,
    });

    // 1. Strategy Execution
    expect(directStrategy.send).toHaveBeenCalled();

    // 2. Worker Trigger
    // ✅ FIX: Expect 'myUrn' (Sender), not 'recipientUrn'
    expect(outboxWorker.processQueue).toHaveBeenCalledWith(myUrn, keys);
  });

  it('should NOT trigger worker for ephemeral messages', async () => {
    await service.sendMessage(keys, myUrn, recipientUrn, typeId, payload, {
      isEphemeral: true,
    });

    expect(directStrategy.send).toHaveBeenCalled();
    expect(outboxWorker.processQueue).not.toHaveBeenCalled();
  });
});
