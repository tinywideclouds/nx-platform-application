import { TestBed } from '@angular/core/testing';
import { ContactsStateService } from './contacts-state.service';
import { ContactsDomainService } from '@nx-platform-application/contacts-domain-service';
import {
  Contact,
  ContactGroup,
  BlockedIdentity,
} from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { of, BehaviorSubject } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ContactsStateService', () => {
  let service: ContactsStateService;
  let domain: ContactsDomainService;

  const mockUserUrn = URN.parse('urn:contacts:user:alice');
  const mockGroupUrn = URN.parse('urn:contacts:group:family');

  const mockContactAlice: Contact = {
    id: mockUserUrn,
    alias: 'Alice',
    firstName: 'Alice',
    surname: 'Wonderland',
    email: '',
    emailAddresses: [],
    phoneNumbers: [],
    serviceContacts: {},
    lastModified: '2025-01-01T00:00:00Z' as any,
  };

  const mockGroup: ContactGroup = {
    id: mockGroupUrn,
    directoryId: URN.parse('urn:directory:group:1'),
    name: 'Family',
    memberUrns: [mockUserUrn],
    lastModified: '2025-01-01T00:00:00Z' as any,
  };

  const mockBlockedEntry: BlockedIdentity = {
    id: 1,
    urn: URN.parse('urn:contacts:user:blocked'),
    blockedAt: '2025-01-01T00:00:00Z' as any,
    scopes: ['messenger'],
  };

  // Reactive Streams
  const contactsSubject = new BehaviorSubject<Contact[]>([mockContactAlice]);
  const groupsSubject = new BehaviorSubject<ContactGroup[]>([mockGroup]);
  const blockedSubject = new BehaviorSubject<BlockedIdentity[]>([
    mockBlockedEntry,
  ]);

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ContactsStateService,
        MockProvider(ContactsDomainService, {
          contacts$: contactsSubject.asObservable(),
          groups$: groupsSubject.asObservable(),
          blocked$: blockedSubject.asObservable(),
          pending$: of([]),
          links$: of([]),
          getGroup: vi.fn().mockResolvedValue(mockGroup),
          saveGroup: vi.fn(), // ✅ Mocked
          getGroupsByParent: vi.fn(), // ✅ Mocked
          createContact: vi.fn(),
          blockIdentity: vi.fn(),
          unblockIdentity: vi.fn(),
        }),
      ],
    });

    service = TestBed.inject(ContactsStateService);
    domain = TestBed.inject(ContactsDomainService);

    TestBed.flushEffects();
  });

  describe('Group Actions', () => {
    it('should delegate saveGroup to Domain', async () => {
      await service.saveGroup(mockGroup);
      expect(domain.saveGroup).toHaveBeenCalledWith(mockGroup);
    });

    it('should delegate getGroupsByParent to Domain', async () => {
      const parentUrn = URN.parse('urn:contacts:group:parent');
      await service.getGroupsByParent(parentUrn);
      expect(domain.getGroupsByParent).toHaveBeenCalledWith(parentUrn);
    });
  });

  describe('Signals', () => {
    it('should expose contacts signal', () => {
      expect(service.contacts()).toHaveLength(1);
      expect(service.contacts()[0].alias).toBe('Alice');
    });
  });

  describe('getGroupParticipants', () => {
    it('should resolve URNs to Contact objects', async () => {
      const participants = await service.getGroupParticipants(mockGroupUrn);
      expect(participants).toHaveLength(1);
      expect(participants[0].id).toEqual(mockUserUrn);
      expect(participants[0].alias).toBe('Alice');
    });
  });
});
