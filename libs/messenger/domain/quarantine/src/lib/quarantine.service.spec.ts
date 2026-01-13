import { TestBed } from '@angular/core/testing';
import { QuarantineService } from './quarantine.service';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { URN } from '@nx-platform-application/platform-types';
import { TransportMessage } from '@nx-platform-application/messenger-types';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { QuarantineStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';

describe('QuarantineService (Gatekeeper)', () => {
  let service: QuarantineService;
  let storage: QuarantineStorage;
  let contacts: ContactsStateService;
  let resolver: IdentityResolver;

  const handleUrn = URN.parse('urn:lookup:email:stranger@test.com');
  const contactUrn = URN.parse('urn:contacts:user:canonical-id');
  const transportMsg = {
    senderId: handleUrn,
    payloadBytes: new Uint8Array([1]),
  } as TransportMessage;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        QuarantineService,
        MockProvider(QuarantineStorage, {
          saveQuarantinedMessage: vi.fn(),
          getQuarantinedSenders: vi.fn(),
          getQuarantinedMessages: vi.fn(),
          deleteQuarantinedMessages: vi.fn(),
        }),
        MockProvider(ContactsStateService, {
          isTrusted: vi.fn(),
        }),
        MockProvider(IdentityResolver, {
          resolveToContact: vi.fn(),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(QuarantineService);
    storage = TestBed.inject(QuarantineStorage);
    contacts = TestBed.inject(ContactsStateService);
    resolver = TestBed.inject(IdentityResolver);
  });

  describe('process (The Gate)', () => {
    it('should REJECT immediately if sender is in Blocked Set', async () => {
      const blockedSet = new Set([handleUrn.toString()]);
      const result = await service.process(transportMsg, blockedSet);
      expect(result).toBeNull();
      expect(storage.saveQuarantinedMessage).not.toHaveBeenCalled();
    });

    it('should DETAIN (Quarantine) if sender is not trusted', async () => {
      vi.mocked(resolver.resolveToContact).mockResolvedValue(contactUrn);
      vi.mocked(contacts.isTrusted).mockResolvedValue(false);

      const result = await service.process(transportMsg, new Set());

      expect(result).toBeNull();
      expect(storage.saveQuarantinedMessage).toHaveBeenCalledWith(transportMsg);
    });

    it('should ALLOW and return Canonical URN if sender is trusted', async () => {
      vi.mocked(resolver.resolveToContact).mockResolvedValue(contactUrn);
      vi.mocked(contacts.isTrusted).mockResolvedValue(true);

      const result = await service.process(transportMsg, new Set());

      expect(result).toEqual(contactUrn);
      expect(storage.saveQuarantinedMessage).not.toHaveBeenCalled();
    });
  });

  describe('Management Ops', () => {
    it('should delegate retrieval to storage', async () => {
      await service.getPendingRequests();
      expect(storage.getQuarantinedSenders).toHaveBeenCalled();
    });
  });
});
