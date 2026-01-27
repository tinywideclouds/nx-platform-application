import { TestBed } from '@angular/core/testing';
import { QuarantineService } from './quarantine.service';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { URN } from '@nx-platform-application/platform-types';
import { TransportMessage } from '@nx-platform-application/messenger-types';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { QuarantineStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';
// ✅ CORRECT IMPORTS
import { AddressBookApi } from '@nx-platform-application/contacts-api';
import { DirectoryQueryApi } from '@nx-platform-application/directory-api';

describe('QuarantineService (Gatekeeper)', () => {
  let service: QuarantineService;
  let storage: QuarantineStorage;
  let addressBook: AddressBookApi;
  let directory: DirectoryQueryApi;
  let metadata: MessageMetadataService;

  const handleUrn = URN.parse('urn:lookup:email:stranger@test.com');
  const contactUrn = URN.parse('urn:contacts:user:canonical-id');
  const groupUrn = URN.parse('urn:messenger:group:123');

  const transportMsg = {
    senderId: handleUrn,
    payloadBytes: new Uint8Array([1]),
  } as TransportMessage;

  const mockContact = { id: contactUrn, alias: 'Friend' };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        QuarantineService,
        MockProvider(QuarantineStorage, {
          saveQuarantinedMessage: vi.fn(),
          getQuarantinedSenders: vi.fn(),
        }),
        MockProvider(IdentityResolver, {
          resolveToContact: vi.fn().mockResolvedValue(contactUrn),
        }),
        MockProvider(MessageMetadataService, {
          unwrap: vi.fn(),
        }),
        // ✅ API Mocks
        MockProvider(AddressBookApi, {
          getContact: vi.fn(),
        }),
        MockProvider(DirectoryQueryApi, {
          getGroup: vi.fn(),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(QuarantineService);
    storage = TestBed.inject(QuarantineStorage);
    addressBook = TestBed.inject(AddressBookApi);
    directory = TestBed.inject(DirectoryQueryApi);
    metadata = TestBed.inject(MessageMetadataService);
  });

  describe('process', () => {
    it('should REJECT immediately if sender is Blocked', async () => {
      const blockedSet = new Set([handleUrn.toString()]);
      const result = await service.process(transportMsg, blockedSet);

      expect(result).toBeNull();
      expect(storage.saveQuarantinedMessage).not.toHaveBeenCalled();
    });

    it('should ALLOW if sender is in Address Book (Contact)', async () => {
      // Simulate Contact Exists
      vi.mocked(addressBook.getContact).mockResolvedValue(mockContact as any);

      const result = await service.process(transportMsg, new Set());

      expect(result).toEqual(contactUrn);
      expect(storage.saveQuarantinedMessage).not.toHaveBeenCalled();
    });

    it('should DETAIN if stranger sends a Direct Message', async () => {
      // Not in Address Book
      vi.mocked(addressBook.getContact).mockResolvedValue(undefined);
      // Is DM (No Conversation ID)
      vi.mocked(metadata.unwrap).mockReturnValue({
        content: new Uint8Array([]),
      });

      const result = await service.process(transportMsg, new Set());

      expect(result).toBeNull();
      expect(storage.saveQuarantinedMessage).toHaveBeenCalledWith(transportMsg);
    });

    it('should ALLOW if stranger is a valid Member of the Group', async () => {
      // Not in Address Book
      vi.mocked(addressBook.getContact).mockResolvedValue(undefined);

      // Is Group Message
      vi.mocked(metadata.unwrap).mockReturnValue({
        conversationId: groupUrn,
        content: new Uint8Array([]),
      });

      // Is Member of Group in Directory
      vi.mocked(directory.getGroup).mockResolvedValue({
        memberState: { [contactUrn.toString()]: 'joined' },
      } as any);

      const result = await service.process(transportMsg, new Set());

      expect(result).toEqual(contactUrn);
      expect(storage.saveQuarantinedMessage).not.toHaveBeenCalled();
    });
  });
});
