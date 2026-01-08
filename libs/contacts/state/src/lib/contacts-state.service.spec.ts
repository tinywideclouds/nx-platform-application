import { TestBed } from '@angular/core/testing';
import { ContactsStateService } from './contacts-state.service';
import {
  ContactsStorageService,
  GatekeeperStorage,
} from '@nx-platform-application/contacts-storage';
import {
  Contact,
  BlockedIdentity,
  PendingIdentity,
} from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ContactsStateService', () => {
  let service: ContactsStateService;
  let storage: ContactsStorageService;
  let gatekeeper: GatekeeperStorage;

  const mockUserUrn = URN.parse('urn:contacts:user:alice');
  const mockBlockedUrn = URN.parse('urn:contacts:user:bob');
  const mockPendingUrn = URN.parse('urn:contacts:user:charlie');

  const mockContactAlice: Contact = {
    id: mockUserUrn,
    alias: 'Alice',
    firstName: 'Alice',
    surname: 'Wonderland',
    email: 'alice@wonderland.img',
    emailAddresses: [],
    phoneNumbers: [],
    serviceContacts: {},
    lastModified: '2025-01-01T00:00:00Z' as any,
  } as Contact;

  const mockBlockedEntry: BlockedIdentity = {
    id: 1,
    urn: mockBlockedUrn,
    blockedAt: '2025-01-01T00:00:00Z' as any,
    scopes: ['messenger'],
  };

  const mockPendingEntry: PendingIdentity = {
    id: 2,
    urn: mockPendingUrn,
    firstSeenAt: '2025-01-01T00:00:00Z' as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ContactsStateService,
        MockProvider(ContactsStorageService, {
          contacts$: of([mockContactAlice]),
          favorites$: of([]),
          groups$: of([]),
          getGroup: vi.fn(),
          getContact: vi.fn(),
          getContactsForGroup: vi.fn().mockResolvedValue([]),
          getAllIdentityLinks: vi.fn().mockResolvedValue([]),
          clearDatabase: vi.fn().mockResolvedValue(undefined),
          clearAllContacts: vi.fn().mockResolvedValue(undefined),
          saveContact: vi.fn().mockResolvedValue(undefined),
          saveGroup: vi.fn().mockResolvedValue(undefined),
          getGroupsByParent: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(GatekeeperStorage, {
          blocked$: of([mockBlockedEntry]),
          pending$: of([mockPendingEntry]),
          blockIdentity: vi.fn().mockResolvedValue(undefined),
          unblockIdentity: vi.fn().mockResolvedValue(undefined),
          deletePending: vi.fn().mockResolvedValue(undefined),
          addToPending: vi.fn().mockResolvedValue(undefined),
          getPendingIdentity: vi.fn().mockResolvedValue(mockPendingEntry),
        }),
      ],
    });

    service = TestBed.inject(ContactsStateService);
    storage = TestBed.inject(ContactsStorageService);
    gatekeeper = TestBed.inject(GatekeeperStorage);

    TestBed.flushEffects();
  });

  describe('Signal State', () => {
    it('should initialize signals from storage observables', () => {
      const contacts = service.contacts();
      expect(contacts.length).toBe(1);

      const blocked = service.blocked();
      expect(blocked.length).toBe(1);

      const pending = service.pending();
      expect(pending.length).toBe(1);
    });
  });

  describe('resolveContact', () => {
    it('should return a reactive signal for a known contact', () => {
      const signal = service.resolveContact(mockUserUrn);
      const contact = signal();
      expect(contact).toBeDefined();
      expect(contact?.alias).toBe('Alice');
    });

    it('should return undefined for unknown contact', () => {
      const unknownUrn = URN.parse('urn:contacts:user:unknown');
      const signal = service.resolveContact(unknownUrn);
      expect(signal()).toBeUndefined();
    });
  });

  describe('Gatekeeper Delegation', () => {
    it('should delegate blockIdentity to gatekeeper and clear pending', async () => {
      await service.blockIdentity(mockPendingUrn, ['all']);
      expect(gatekeeper.blockIdentity).toHaveBeenCalledWith(mockPendingUrn, [
        'all',
      ]);
      expect(gatekeeper.deletePending).toHaveBeenCalledWith(mockPendingUrn);
    });

    it('should delegate addToPending', async () => {
      await service.addToPending(mockPendingUrn);
      expect(gatekeeper.addToPending).toHaveBeenCalledWith(
        mockPendingUrn,
        undefined,
        undefined,
      );
    });

    it('should delegate getPendingIdentity', async () => {
      const result = await service.getPendingIdentity(mockPendingUrn);
      expect(gatekeeper.getPendingIdentity).toHaveBeenCalledWith(
        mockPendingUrn,
      );
      expect(result).toEqual(mockPendingEntry);
    });
  });
});
