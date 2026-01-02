import { TestBed } from '@angular/core/testing';
import { OutboundService } from './outbound.service';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { ChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { Logger } from '@nx-platform-application/console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';

// ✅ ARCHITECTURE FIX: Import Contract from Infrastructure
import { OutboxStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';

import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';

describe('OutboundService', () => {
  let service: OutboundService;
  let storageService: ChatStorageService;
  let cryptoService: MessengerCryptoService;
  let metadataService: MessageMetadataService;
  let outboxStorage: OutboxStorage;

  const myUrn = URN.parse('urn:auth:user:me');
  const contactUrn = URN.parse('urn:contacts:user:bob');
  const handleUrn = URN.parse('urn:lookup:email:bob@test.com');
  const typeId = URN.parse('urn:message:type:text');
  const signalId = URN.parse('urn:message:type:read-receipt');
  const rawPayload = new Uint8Array([72, 101, 108, 108, 111]);
  const wrappedPayload = new Uint8Array([255, 255, 255]);

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        OutboundService,
        MockProvider(ChatSendService, {
          sendMessage: vi.fn().mockReturnValue(of(undefined)),
        }),
        MockProvider(MessengerCryptoService, {
          encryptAndSign: vi.fn().mockResolvedValue({ recipientId: handleUrn }),
        }),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(undefined),
          updateMessageStatus: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(KeyCacheService, {
          getPublicKey: vi.fn().mockResolvedValue({}),
        }),
        MockProvider(IdentityResolver, {
          resolveToHandle: vi.fn().mockResolvedValue(handleUrn),
          getStorageUrn: vi.fn().mockResolvedValue(contactUrn),
        }),
        MockProvider(MessageMetadataService, {
          wrap: vi.fn().mockReturnValue(wrappedPayload),
        }),
        MockProvider(OutboxStorage, {
          addTask: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(OutboxWorkerService, { processQueue: vi.fn() }),
        MockProvider(ContactsStateService, {
          getGroupParticipants: vi.fn().mockResolvedValue([{ id: contactUrn }]),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(OutboundService);
    storageService = TestBed.inject(ChatStorageService);
    cryptoService = TestBed.inject(MessengerCryptoService);
    metadataService = TestBed.inject(MessageMetadataService);
    outboxStorage = TestBed.inject(OutboxStorage);
  });

  describe('Signal Handling', () => {
    it('should BYPASS metadata wrap for ephemeral signals', async () => {
      await service.sendMessage(
        {} as any,
        myUrn,
        contactUrn,
        signalId,
        rawPayload,
        { isEphemeral: true },
      );

      // Metadata wrap should NOT be called
      expect(metadataService.wrap).not.toHaveBeenCalled();

      // Crypto should receive the RAW payload
      expect(cryptoService.encryptAndSign).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadBytes: rawPayload,
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should NOT save ephemeral signals to local storage', async () => {
      await service.sendMessage(
        {} as any,
        myUrn,
        contactUrn,
        signalId,
        rawPayload,
        { isEphemeral: true },
      );

      expect(storageService.saveMessage).not.toHaveBeenCalled();
    });
  });

  describe('Standard Messaging', () => {
    it('should use metadata wrap for non-ephemeral content', async () => {
      await service.sendMessage(
        {} as any,
        myUrn,
        contactUrn,
        typeId,
        rawPayload,
        { isEphemeral: false },
      );

      expect(metadataService.wrap).toHaveBeenCalled();
      expect(storageService.saveMessage).toHaveBeenCalled();
    });
  });
});
