import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { URN } from '@nx-platform-application/platform-types';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import {
  GroupNotFoundError,
  EmptyGroupError,
} from '@nx-platform-application/contacts-types';
import { ContactsStateService } from './contacts-state.service';
import { Contact } from '@nx-platform-application/contacts-types';

describe('ContactsStateService', () => {
  let service: ContactsStateService;
  let storage: ContactsStorageService;

  const mockGroupUrn = URN.parse('urn:messenger:group:germany-1');
  const mockUserUrn = URN.parse('urn:user:alice');
  const mockBlockedUrn = URN.parse('urn:user:bob');

  // Helper to simulate storage state
  const mockContacts: Contact[] = [
    { id: mockUserUrn, alias: 'Alice' } as any,
    { id: mockBlockedUrn, alias: 'Bob' } as any,
  ];

  const mockBlocked = [
    { urn: mockBlockedUrn, scopes: ['messenger'] }, // Bob is blocked on Messenger
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ContactsStateService,
        MockProvider(ContactsStorageService, {
          // Provide default observables for signals to initialize
          contacts$: of([]),
          favorites$: of([]),
          groups$: of([]),
          blocked$: of([]),
          getGroup: vi.fn(),
          getContactsForGroup: vi.fn(),
          blockIdentity: vi.fn().mockResolvedValue(undefined),
          deletePending: vi.fn().mockResolvedValue(undefined),
        }),
      ],
    });

    service = TestBed.inject(ContactsStateService);
    storage = TestBed.inject(ContactsStorageService);
  });

  describe('Group Resolution Guards', () => {
    it('should throw GroupNotFoundError if the group does not exist', async () => {
      vi.mocked(storage.getGroup).mockResolvedValue(undefined);

      await expect(service.getGroupParticipants(mockGroupUrn)).rejects.toThrow(
        GroupNotFoundError,
      );
    });

    it('should throw EmptyGroupError if the group exists but has no members', async () => {
      // Group exists
      vi.mocked(storage.getGroup).mockResolvedValue({
        id: mockGroupUrn,
        name: 'Empty Group',
        contactIds: [],
      });
      // But resolution returns nothing
      vi.mocked(storage.getContactsForGroup).mockResolvedValue([]);

      await expect(service.getGroupParticipants(mockGroupUrn)).rejects.toThrow(
        EmptyGroupError,
      );
    });

    it('should return contacts if the group is active', async () => {
      const mockContact = { id: mockUserUrn, alias: 'Alice' } as any;
      vi.mocked(storage.getGroup).mockResolvedValue({
        id: mockGroupUrn,
        name: 'Active Group',
        contactIds: [mockUserUrn],
      });
      vi.mocked(storage.getContactsForGroup).mockResolvedValue([mockContact]);

      const result = await service.getGroupParticipants(mockGroupUrn);
      expect(result).toEqual([mockContact]);
    });
  });

  describe('Atomic Operations', () => {
    it('should block an identity AND clear pending status simultaneously', async () => {
      await service.blockIdentity(mockUserUrn, ['messenger']);

      expect(storage.blockIdentity).toHaveBeenCalledWith(mockUserUrn, [
        'messenger',
      ]);
      expect(storage.deletePending).toHaveBeenCalledWith(mockUserUrn);
    });
  });

  describe('Blocking Signals', () => {
    it('should return a filtered signal for a specific scope', () => {
      const blockedList = [
        { urn: URN.parse('urn:user:spam'), scopes: ['all'] },
        { urn: URN.parse('urn:user:marketing'), scopes: ['messenger'] },
        { urn: URN.parse('urn:user:ignored'), scopes: ['files'] },
      ];

      // Update the storage observable
      (storage as any).blocked$ = of(blockedList);

      // Re-inject/Re-init for signal to pick up new observable
      const messengerSignal = service.getFilteredBlockedSet('messenger');

      // We check that 'all' and 'messenger' are present, but 'files' is not
      const result = messengerSignal();
      expect(result.has('urn:user:spam')).toBe(true);
      expect(result.has('urn:user:marketing')).toBe(true);
      expect(result.has('urn:user:ignored')).toBe(false);
    });
  });

  describe('isTrusted (Scope Aware)', () => {
    it('should return TRUE for a contact who is not blocked', async () => {
      // Alice is in contacts and not in blocklist
      const result = await service.isTrusted(mockUserUrn, 'messenger');
      expect(result).toBe(true);
    });

    it('should return FALSE for a contact who is explicitly blocked for scope', async () => {
      // Bob is in contacts BUT blocked for 'messenger'
      const result = await service.isTrusted(mockBlockedUrn, 'messenger');
      expect(result).toBe(false);
    });

    it('should return TRUE for a contact blocked on a DIFFERENT scope', async () => {
      // Bob is blocked on 'messenger', but we are checking 'email'
      const result = await service.isTrusted(mockBlockedUrn, 'email');
      expect(result).toBe(true);
    });

    it('should return FALSE for a stranger (not in contacts)', async () => {
      const stranger = URN.parse('urn:user:stranger');
      const result = await service.isTrusted(stranger, 'messenger');
      expect(result).toBe(false);
    });
  });
});
