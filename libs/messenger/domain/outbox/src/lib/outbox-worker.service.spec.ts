import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MockProvider } from 'ng-mocks';
import { URN } from '@nx-platform-application/platform-types';
import { OutboundTask } from '@nx-platform-application/messenger-types';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { Logger } from '@nx-platform-application/console-logger';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';

import { OutboxStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';

import { OutboxWorkerService } from './outbox-worker.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OutboxWorkerService', () => {
  let service: OutboxWorkerService;
  let storage: OutboxStorage;
  let metadataService: MessageMetadataService;

  const mockSender = URN.parse('urn:contacts:user:me');
  const mockKeys = { encKey: {} as any, sigKey: {} as any };

  let task: OutboundTask; // Defined here, initialized in beforeEach

  beforeEach(() => {
    // ✅ FIX: Re-initialize task before EVERY test to prevent 'sent' state leaking
    task = {
      id: 't1',
      messageId: 'm1',
      conversationUrn: URN.parse('urn:messenger:group:g1'),
      typeId: URN.parse('urn:message:type:text'),
      payload: new Uint8Array([1]),
      tags: [URN.parse('urn:tags:label:test')],
      status: 'queued',
      createdAt: '2025-01-01T10:00:00Z' as any,
      recipients: [
        {
          urn: URN.parse('urn:contacts:user:alice'),
          status: 'pending',
          attempts: 0,
        },
      ],
    };

    TestBed.configureTestingModule({
      providers: [
        OutboxWorkerService,
        MockProvider(OutboxStorage, {
          // Return the fresh task instance
          getPendingTasks: vi.fn().mockResolvedValue([task]),
          updateTaskStatus: vi.fn().mockResolvedValue(undefined),
          updateRecipientProgress: vi.fn().mockResolvedValue(undefined),
          clearAll: vi.fn().mockResolvedValue(undefined),
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
    storage = TestBed.inject(OutboxStorage);
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

  it('should update recipient progress on success', async () => {
    await service.processQueue(mockSender, mockKeys);

    expect(storage.updateRecipientProgress).toHaveBeenCalledWith(
      task.id,
      expect.arrayContaining([
        expect.objectContaining({
          urn: task.recipients[0].urn,
          status: 'sent',
        }),
      ]),
    );
  });

  it('should mark task as completed when all recipients are sent', async () => {
    await service.processQueue(mockSender, mockKeys);

    expect(storage.updateTaskStatus).toHaveBeenCalledWith(task.id, 'completed');
  });
});
