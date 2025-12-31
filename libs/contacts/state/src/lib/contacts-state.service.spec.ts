import { TestBed } from '@angular/core/testing';
import { ContactsStateService } from './contacts-state.service';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import {
  Contact,
  ContactGroup,
  BlockedIdentity,
  GroupNotFoundError,
  EmptyGroupError,
} from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ContactsStateService', () => {
  let service: ContactsStateService;
  let storage: ContactsStorageService;

  // --- Fixtures ---
  const mockUserUrn = URN.parse('urn:contacts:user:alice');
  const mockBlockedUrn = URN.parse('urn:contacts:user:bob');
  const mockGroupUrn = URN.parse('urn:messenger:group:team');

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

  const mockContactBob: Contact = {
    id: mockBlockedUrn,
    alias: 'Bob',
    firstName: 'Bob',
    email: 'bob@wonderland.fk',
    surname: 'Builder',
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

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ContactsStateService,
        MockProvider(ContactsStorageService, {
          // Signals / Observables
          contacts$: of([mockContactAlice, mockContactBob]),
          favorites$: of([]),
          groups$: of([]),
          blocked$: of([mockBlockedEntry]),

          // Methods
          getGroup: vi.fn(),
          getContactsForGroup: vi.fn(),
          blockIdentity: vi.fn().mockResolvedValue(undefined),
          unblockIdentity: vi.fn().mockResolvedValue(undefined),
          deletePending: vi.fn().mockResolvedValue(undefined),
          getAllIdentityLinks: vi.fn().mockResolvedValue([]),
          clearDatabase: vi.fn().mockResolvedValue(undefined),
          clearAllContacts: vi.fn().mockResolvedValue(undefined), // Updated name
        }),
      ],
    });

    service = TestBed.inject(ContactsStateService);
    storage = TestBed.inject(ContactsStorageService);

    // Flush signals (if necessary in environment)
    TestBed.flushEffects();
  });

  describe('Signal State', () => {
    it('should initialize signals from storage observables', () => {
      const contacts = service.contacts();
      expect(contacts.length).toBe(2);
      expect(contacts.find((c: Contact) => c.alias === 'Alice')).toBeTruthy();

      const blocked = service.blocked();
      expect(blocked.length).toBe(1);
      expect(blocked[0].urn.toString()).toBe(mockBlockedUrn.toString());
    });
  });

  describe('API Support Methods', () => {
    describe('getContactSnapshot', () => {
      it('should return contact from internal map synchronously', () => {
        const result = service.getContactSnapshot(mockUserUrn);
        expect(result).toBeDefined();
        expect(result?.alias).toBe('Alice');
      });

      it('should return undefined for unknown URN', () => {
        const unknown = URN.parse('urn:contacts:user:unknown');
        const result = service.getContactSnapshot(unknown);
        expect(result).toBeUndefined();
      });
    });

    describe('getGroupParticipants', () => {
      it('should retrieve participants from storage', async () => {
        // Arrange
        vi.mocked(storage.getGroup).mockResolvedValue({
          id: mockGroupUrn,
        } as ContactGroup);
        vi.mocked(storage.getContactsForGroup).mockResolvedValue([
          mockContactAlice,
        ]);

        // Act
        const result = await service.getGroupParticipants(mockGroupUrn);

        // Assert
        expect(storage.getGroup).toHaveBeenCalledWith(mockGroupUrn);
        expect(storage.getContactsForGroup).toHaveBeenCalledWith(mockGroupUrn);
        expect(result).toEqual([mockContactAlice]);
      });

      it('should throw GroupNotFoundError if group does not exist', async () => {
        vi.mocked(storage.getGroup).mockResolvedValue(undefined);

        await expect(
          service.getGroupParticipants(mockGroupUrn),
        ).rejects.toThrow(GroupNotFoundError);
      });

      it('should throw EmptyGroupError if group has no participants', async () => {
        vi.mocked(storage.getGroup).mockResolvedValue({
          id: mockGroupUrn,
        } as ContactGroup);
        vi.mocked(storage.getContactsForGroup).mockResolvedValue([]);

        await expect(
          service.getGroupParticipants(mockGroupUrn),
        ).rejects.toThrow(EmptyGroupError);
      });
    });

    describe('isBlocked (Implicit API)', () => {
      it('should return true if blocked in scope', async () => {
        const result = await service.isBlocked(mockBlockedUrn, 'messenger');
        expect(result).toBe(true);
      });

      it('should return false if not blocked', async () => {
        const result = await service.isBlocked(mockUserUrn, 'messenger');
        expect(result).toBe(false);
      });

      it('should return false if blocked in different scope', async () => {
        // Bob is blocked for 'messenger', check 'email'
        const result = await service.isBlocked(mockBlockedUrn, 'email');
        expect(result).toBe(false);
      });
    });
  });

  describe('Existing Trust Logic', () => {
    it('isTrusted should return true for unblocked contact', async () => {
      const trusted = await service.isTrusted(mockUserUrn, 'messenger');
      expect(trusted).toBe(true);
    });

    it('isTrusted should return false for blocked contact', async () => {
      const trusted = await service.isTrusted(mockBlockedUrn, 'messenger');
      expect(trusted).toBe(false);
    });

    it('isTrusted should return false for unknown URN', async () => {
      const unknown = URN.parse('urn:contacts:user:stranger');
      const trusted = await service.isTrusted(unknown, 'messenger');
      expect(trusted).toBe(false);
    });
  });
});
