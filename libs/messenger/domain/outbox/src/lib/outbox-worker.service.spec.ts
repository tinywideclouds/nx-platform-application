import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MockProvider } from 'ng-mocks';
import { URN } from '@nx-platform-application/platform-types';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/chat-access';
import { Logger } from '@nx-platform-application/console-logger';
import { MessageMetadataService } from '@nx-platform-application/message-content';

import { OutboxWorkerService } from './outbox-worker.service';
import { OutboxRepository } from './outbox.repository';
import { OutboundTask } from './models/outbound-task.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OutboxWorkerService', () => {
  let service: OutboxWorkerService;
  let repo: OutboxRepository;
  let metadataService: MessageMetadataService;

  const mockSender = URN.parse('urn:user:me');
  const mockKeys = { encKey: {} as any, sigKey: {} as any };

  const task: OutboundTask = {
    id: 't1',
    messageId: 'm1',
    conversationUrn: URN.parse('urn:messenger:group:g1'),
    typeId: URN.parse('urn:message:type:text'),
    payload: new Uint8Array([1]),
    tags: [URN.parse('urn:tag:test')],
    status: 'queued',
    createdAt: '2025-01-01T10:00:00Z' as any,
    recipients: [
      { urn: URN.parse('urn:user:alice'), status: 'pending', attempts: 0 },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OutboxWorkerService,
        MockProvider(OutboxRepository, {
          getPendingTasks: vi.fn().mockResolvedValue([task]),
          updateTaskStatus: vi.fn().mockResolvedValue(undefined),
          updateRecipientProgress: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(KeyCacheService, {
          getPublicKey: vi.fn().mockResolvedValue({}),
        }),
        MockProvider(MessengerCryptoService, {
          encryptAndSign: vi.fn().mockResolvedValue({ id: 'env-1' }),
        }),
        MockProvider(ChatSendService, {
          sendMessage: vi.fn().mockReturnValue(of({ success: true })),
        }),
        MockProvider(MessageMetadataService, {
          wrap: vi.fn().mockReturnValue(new Uint8Array([1, 1, 1])),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(OutboxWorkerService);
    repo = TestBed.inject(OutboxRepository);
    metadataService = TestBed.inject(MessageMetadataService);
  });

  it('should call metadataService.wrap during delivery', async () => {
    await service.processQueue(mockSender, mockKeys);

    expect(metadataService.wrap).toHaveBeenCalledWith(
      task.payload,
      task.conversationUrn,
      task.tags,
    );
  });
});
