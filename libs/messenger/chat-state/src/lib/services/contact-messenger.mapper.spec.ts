import { TestBed } from '@angular/core/testing';
import { ContactMessengerMapper } from './contact-messenger.mapper';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  ContactsStorageService,
  ServiceContact,
} from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { MockProvider } from 'ng-mocks';
import { vi } from 'vitest';
import { signal } from '@angular/core';

// Fixtures
const contactUrn = URN.parse('urn:contacts:user:bob');
const authUrn = URN.parse('urn:auth:google:bob-123');
const lookupUrn = URN.parse('urn:lookup:email:bob@test.com');
const myUrn = URN.parse('urn:message:user:me');

const sc: Record<string, ServiceContact> = {
  hi: {
    id: URN.parse('urn:a:b:c'),
    alias: 'b',
    lastSeen: '' as ISODateTimeString,
  },
};

const mockContact = {
  id: contactUrn,
  email: 'bob@test.com',
  alias: 'Bob',
  firstName: 'bob',
  surname: 'wills',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: sc,
};

const mockCurrentUser = {
  id: myUrn,
  email: 'me@test.com',
  alias: 'Me',
  firstName: 't',
  surname: 'h',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: sc,
};

describe('ContactMessengerMapper', () => {
  let service: ContactMessengerMapper;
  let contactsService: ContactsStorageService;
  let authService: IAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ContactMessengerMapper,
        // ✅ Mocking the storage service
        MockProvider(ContactsStorageService, {
          getLinkedIdentities: vi.fn().mockResolvedValue([]),
          getContact: vi.fn(),
          findByEmail: vi.fn(),
          findContactByAuthUrn: vi.fn(),
        }),
        // ✅ Mocking Auth (fixing the missing dependency)
        MockProvider(IAuthService, {
          currentUser: signal(mockCurrentUser),
        }),
        MockProvider(Logger),
      ],
    });
    service = TestBed.inject(ContactMessengerMapper);
    contactsService = TestBed.inject(ContactsStorageService);
    authService = TestBed.inject(IAuthService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveToHandle (Forward)', () => {
    it('should passthrough if already a handle', async () => {
      expect(await service.resolveToHandle(lookupUrn)).toBe(lookupUrn);
    });

    it('should resolve SELF to the public email handle', async () => {
      // Since authService.currentUser() returns mockCurrentUser (me@test.com)
      const result = await service.resolveToHandle(myUrn);
      expect(result.toString()).toBe('urn:lookup:email:me@test.com');
    });

    it('should resolve via Identity Link if available', async () => {
      vi.spyOn(contactsService, 'getLinkedIdentities').mockResolvedValue([
        authUrn,
      ]);
      const result = await service.resolveToHandle(contactUrn);
      expect(result).toBe(authUrn);
    });

    it('should resolve via Email Discovery if no link', async () => {
      vi.spyOn(contactsService, 'getContact').mockResolvedValue(mockContact);

      const result = await service.resolveToHandle(contactUrn);
      expect(result.toString()).toBe(lookupUrn.toString());
    });

    it('should fallback to original URN if resolution fails', async () => {
      vi.spyOn(contactsService, 'getContact').mockResolvedValue({
        ...mockContact,
        email: '',
      });

      const result = await service.resolveToHandle(contactUrn);
      expect(result).toBe(contactUrn);
    });
  });

  describe('resolveToContact (Reverse)', () => {
    it('should map Email Lookup URN to Contact via findByEmail', async () => {
      vi.spyOn(contactsService, 'findByEmail').mockResolvedValue(mockContact);

      const result = await service.resolveToContact(lookupUrn);
      expect(result).toEqual(contactUrn);
      expect(contactsService.findByEmail).toHaveBeenCalledWith('bob@test.com');
    });

    it('should map Auth URN to Contact via findContactByAuthUrn', async () => {
      vi.spyOn(contactsService, 'findContactByAuthUrn').mockResolvedValue(
        mockContact
      );

      const result = await service.resolveToContact(authUrn);
      expect(result).toEqual(contactUrn);
    });

    it('should return Handle if no Contact found (Stranger)', async () => {
      vi.spyOn(contactsService, 'findByEmail').mockResolvedValue(undefined);
      const strangerUrn = URN.parse('urn:lookup:email:stranger@test.com');

      const result = await service.resolveToContact(strangerUrn);
      expect(result).toBe(strangerUrn);
    });
  });

  describe('getStorageUrn', () => {
    it('should prefer Contact URN if available', async () => {
      expect(await service.getStorageUrn(contactUrn)).toBe(contactUrn);

      vi.spyOn(contactsService, 'findByEmail').mockResolvedValue(mockContact);
      expect(await service.getStorageUrn(lookupUrn)).toEqual(contactUrn);
    });

    it('should use Handle URN for strangers', async () => {
      vi.spyOn(contactsService, 'findByEmail').mockResolvedValue(undefined);
      expect(await service.getStorageUrn(lookupUrn)).toBe(lookupUrn);
    });
  });
});
