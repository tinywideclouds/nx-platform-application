import { TestBed } from '@angular/core/testing';
import { ContactMapper } from './contact.mapper';
import { URN } from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { StorableContact } from '../records/contact.record';

describe('ContactMapper', () => {
  let mapper: ContactMapper;

  const mockContact: Contact = {
    id: URN.parse('urn:contacts:user:alice'),
    alias: 'Alice',
    firstName: 'Alice',
    surname: 'Wonderland',
    email: 'alice@wonderland.img',
    emailAddresses: ['alice@example.com'],
    phoneNumbers: [],
    lastModified: '2023-01-01T10:00:00Z' as any,
    serviceContacts: {
      messenger: {
        id: URN.parse('urn:messenger:user:alice'),
        alias: '@alice',
        lastSeen: '2023-01-01T12:00:00Z' as any,
      },
    },
  };

  const mockStorable: StorableContact = {
    id: 'urn:contacts:user:alice',
    alias: 'Alice',
    firstName: 'Alice',
    surname: 'Wonderland',
    email: '', // Deprecated field legacy check
    emailAddresses: ['alice@example.com'],
    phoneNumbers: [],
    lastModified: '2023-01-01T10:00:00Z' as any,
    serviceContacts: {
      messenger: {
        id: 'urn:messenger:user:alice',
        alias: '@alice',
        lastSeen: '2023-01-01T12:00:00Z' as any,
      },
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContactMapper],
    });
    mapper = TestBed.inject(ContactMapper);
  });

  describe('toStorable', () => {
    it('should map domain contact to storable record', () => {
      const result = mapper.toStorable(mockContact);
      expect(result.id).toBe('urn:contacts:user:alice');
      expect(result.emailAddresses).toContain('alice@example.com');
    });

    it('should map nested service contacts dictionary', () => {
      const result = mapper.toStorable(mockContact);
      const msgContact = result.serviceContacts['messenger'];

      expect(msgContact).toBeDefined();
      expect(msgContact.id).toBe('urn:messenger:user:alice');
      expect(typeof msgContact.id).toBe('string');
    });
  });

  describe('toDomain', () => {
    it('should hydrate storable record back to domain', () => {
      const result = mapper.toDomain(mockStorable);
      expect(result.id).toBeInstanceOf(URN);
      expect(result.serviceContacts['messenger'].id).toBeInstanceOf(URN);
    });

    it('should handle missing service contacts gracefully', () => {
      const emptyServices = {
        ...mockStorable,
        serviceContacts: undefined as any,
      };
      const result = mapper.toDomain(emptyServices);
      expect(result.serviceContacts).toEqual({});
    });
  });
});
