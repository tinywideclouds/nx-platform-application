import { TestBed } from '@angular/core/testing';
import { ContactMessengerMapper } from './contact-messenger.mapper';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ContactMessengerMapper (Adapter)', () => {
  let service: ContactMessengerMapper;

  const mockContacts = {
    getLinkedIdentities: vi.fn(),
    getContact: vi.fn(),
    findByEmail: vi.fn(),
    findContactByAuthUrn: vi.fn(),
  };

  // Mocking the Signal-based Auth Service
  const mockAuth = {
    currentUser: signal<{ id: URN; email?: string } | null>(null),
  };

  const contactUrn = URN.parse('urn:contacts:user:bob');
  const emailHandle = URN.parse('urn:lookup:email:bob@test.com');
  const authHandle = URN.parse('urn:auth:google:bob');

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ContactMessengerMapper,
        { provide: ContactsStorageService, useValue: mockContacts },
        { provide: IAuthService, useValue: mockAuth },
        { provide: Logger, useValue: { warn: vi.fn() } },
      ],
    });
    service = TestBed.inject(ContactMessengerMapper);
  });

  describe('resolveToHandle (Forward)', () => {
    it('should use Identity Links first (Explicit Handshake)', async () => {
      mockContacts.getLinkedIdentities.mockResolvedValue([authHandle]);

      const result = await service.resolveToHandle(contactUrn);
      expect(result).toBe(authHandle);
    });

    it('should use Email Discovery if no links (Opportunistic)', async () => {
      mockContacts.getLinkedIdentities.mockResolvedValue([]);
      mockContacts.getContact.mockResolvedValue({ email: 'bob@test.com' });

      const result = await service.resolveToHandle(contactUrn);
      expect(result.toString()).toBe(emailHandle.toString());
    });

    it('should use Self Email if resolving own URN', async () => {
      const meUrn = URN.parse('urn:contacts:user:me');

      // Update signal with a typed object
      mockAuth.currentUser.set({ id: meUrn, email: 'me@test.com' });

      const result = await service.resolveToHandle(meUrn);
      expect(result.toString()).toBe('urn:lookup:email:me@test.com');
    });
  });

  describe('resolveToContact (Reverse)', () => {
    it('should map Email Handle to Contact', async () => {
      mockContacts.findByEmail.mockResolvedValue({ id: contactUrn });

      const result = await service.resolveToContact(emailHandle);
      expect(result).toEqual(contactUrn);
    });

    it('should return Handle if Stranger (No Contact Found)', async () => {
      mockContacts.findByEmail.mockResolvedValue(undefined);

      const result = await service.resolveToContact(emailHandle);
      expect(result).toBe(emailHandle);
    });
  });
});
