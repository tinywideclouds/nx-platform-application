import { TestBed } from '@angular/core/testing';
import { ContactMessengerMapper } from './contact-messenger.mapper';
import { URN } from '@nx-platform-application/platform-types';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { vi } from 'vitest';

const mockLogger = { warn: vi.fn() };
const mockContactsService = {
  getLinkedIdentities: vi.fn(),
  getContact: vi.fn(),
  findByEmail: vi.fn(),
  findContactByAuthUrn: vi.fn(),
};

// Fixtures
const contactUrn = URN.parse('urn:sm:user:bob');
const authUrn = URN.parse('urn:auth:google:bob-123');
const lookupUrn = URN.parse('urn:lookup:email:bob@test.com');

const mockContact = {
  id: contactUrn,
  email: 'bob@test.com',
  alias: 'Bob',
};

describe('ContactMessengerMapper', () => {
  let service: ContactMessengerMapper;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ContactMessengerMapper,
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: Logger, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(ContactMessengerMapper);
  });

  describe('resolveToHandle (Forward)', () => {
    it('should passthrough if already a handle', async () => {
      expect(await service.resolveToHandle(lookupUrn)).toBe(lookupUrn);
    });

    it('should resolve via Identity Link if available', async () => {
      mockContactsService.getLinkedIdentities.mockResolvedValue([authUrn]);
      const result = await service.resolveToHandle(contactUrn);
      expect(result).toBe(authUrn);
    });

    it('should resolve via Email Discovery if no link', async () => {
      mockContactsService.getLinkedIdentities.mockResolvedValue([]);
      mockContactsService.getContact.mockResolvedValue(mockContact);

      const result = await service.resolveToHandle(contactUrn);
      expect(result.toString()).toBe(lookupUrn.toString());
    });

    it('should fallback to original URN if resolution fails', async () => {
      mockContactsService.getLinkedIdentities.mockResolvedValue([]);
      mockContactsService.getContact.mockResolvedValue({ ...mockContact, email: null });

      const result = await service.resolveToHandle(contactUrn);
      expect(result).toBe(contactUrn);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('resolveToContact (Reverse)', () => {
    it('should map Email Lookup URN to Contact via findByEmail', async () => {
      mockContactsService.findByEmail.mockResolvedValue(mockContact);

      const result = await service.resolveToContact(lookupUrn);
      expect(result).toEqual(contactUrn);
      expect(mockContactsService.findByEmail).toHaveBeenCalledWith('bob@test.com');
    });

    it('should map Auth URN to Contact via findContactByAuthUrn', async () => {
      mockContactsService.findContactByAuthUrn.mockResolvedValue(mockContact);

      const result = await service.resolveToContact(authUrn);
      expect(result).toEqual(contactUrn);
    });

    it('should return Handle if no Contact found (Stranger)', async () => {
      mockContactsService.findByEmail.mockResolvedValue(null);
      const strangerUrn = URN.parse('urn:lookup:email:stranger@test.com');

      const result = await service.resolveToContact(strangerUrn);
      expect(result).toBe(strangerUrn);
    });
  });

  describe('getStorageUrn', () => {
    it('should prefer Contact URN if available', async () => {
      // Case 1: Input is Contact
      expect(await service.getStorageUrn(contactUrn)).toBe(contactUrn);

      // Case 2: Input is Handle that maps to Contact
      mockContactsService.findByEmail.mockResolvedValue(mockContact);
      expect(await service.getStorageUrn(lookupUrn)).toEqual(contactUrn);
    });

    it('should use Handle URN for strangers', async () => {
      mockContactsService.findByEmail.mockResolvedValue(null);
      expect(await service.getStorageUrn(lookupUrn)).toBe(lookupUrn);
    });
  });
});