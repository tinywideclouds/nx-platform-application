import { TestBed } from '@angular/core/testing';
import { ContactsFacadeService } from './contacts-facade.service';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import {
  Contact,
  ContactGroup,
  BlockedIdentity,
  PendingIdentity,
} from '@nx-platform-application/contacts-types';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { of, firstValueFrom } from 'rxjs';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ContactsFacadeService', () => {
  let service: ContactsFacadeService;
  let state: ContactsStateService;

  const mockUrn = URN.parse('urn:contacts:user:test');
  const mockContact: Contact = {
    id: mockUrn,
    alias: 'Test User',
    firstName: 'test',
    surname: 'user',
    email: 'user@test.com',
    phoneNumbers: [],
    emailAddresses: [],
    lastModified: '' as ISODateTimeString,
    serviceContacts: {
      messenger: {
        id: URN.parse('urn:messenger:user:test'),
        alias: 'Test',
        lastSeen: '2023-01-01' as any,
      },
    },
  } as Contact;

  const mockBlocked: BlockedIdentity[] = [
    {
      id: 1,
      urn: mockUrn,
      blockedAt: '2025-01-01' as any,
      scopes: ['all'],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ContactsFacadeService,
        MockProvider(ContactsStateService, {
          contacts$: of([mockContact]),
          groups$: of([]),
          blocked$: of(mockBlocked),
          pending$: of([]),
          // Mock Signals
          contacts: signal([mockContact]),
          blocked: signal(mockBlocked),
          // Mock Methods
          getContact: vi.fn().mockResolvedValue(mockContact),
          getGroup: vi.fn().mockResolvedValue(undefined),
          getGroupsByParent: vi.fn().mockResolvedValue([]), // ✅ Added
          saveContact: vi.fn().mockResolvedValue(undefined),
          saveGroup: vi.fn().mockResolvedValue(undefined),
          createContact: vi.fn().mockResolvedValue(mockUrn), // ✅ Added
          clearDatabase: vi.fn().mockResolvedValue(undefined), // ✅ Added

          blockIdentity: vi.fn().mockResolvedValue(undefined),
          unblockIdentity: vi.fn().mockResolvedValue(undefined), // ✅ Added
          addToPending: vi.fn().mockResolvedValue(undefined),
          getPendingIdentity: vi.fn().mockResolvedValue(null), // ✅ Added
          deletePending: vi.fn().mockResolvedValue(undefined), // ✅ Added

          getGroupParticipants: vi.fn().mockResolvedValue([mockContact]),
          isBlocked: vi.fn().mockResolvedValue(false),
          getContactSnapshot: vi.fn().mockReturnValue(mockContact),
        }),
      ],
    });

    service = TestBed.inject(ContactsFacadeService);
    state = TestBed.inject(ContactsStateService);
  });

  describe('AddressBookApi', () => {
    it('should delegate getContact to state', async () => {
      const result = await service.getContact(mockUrn);
      expect(state.getContact).toHaveBeenCalledWith(mockUrn);
      expect(result).toBe(mockContact);
    });

    it('should delegate saveContact to state', async () => {
      await service.saveContact(mockContact);
      expect(state.saveContact).toHaveBeenCalledWith(mockContact);
    });
  });

  describe('GatekeeperApi', () => {
    it('should expose blocked$ observable from state', async () => {
      const blocked = await firstValueFrom(service.blocked$);
      expect(blocked).toBe(mockBlocked);
    });

    it('should delegate blockIdentity to state', async () => {
      await service.blockIdentity(mockUrn, ['messenger'], 'spam');
      expect(state.blockIdentity).toHaveBeenCalledWith(mockUrn, ['messenger']);
    });

    it('should delegate addToPending to state', async () => {
      await service.addToPending(mockUrn);
      expect(state.addToPending).toHaveBeenCalledWith(
        mockUrn,
        undefined,
        undefined,
      );
    });
  });

  describe('ContactsQueryApi', () => {
    it('should map domain contacts to summaries', async () => {
      const summaries = await service.getGroupParticipants(mockUrn);
      expect(summaries.length).toBe(1);
      expect(summaries[0].id).toBe(mockContact.id);
      expect(summaries[0].alias).toBe(mockContact.alias);
    });

    it('should map profile picture in summary', async () => {
      const result = await service.resolveIdentity(mockUrn);
      expect(result).not.toBeNull();
      expect(result?.profilePictureUrl).toBeUndefined(); // mockContact has no pic in this test setup
    });
  });
});
