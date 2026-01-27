import { TestBed } from '@angular/core/testing';
import { ContactMapper } from './contact.mapper';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { StorableContact } from '../records/contact.record';

describe('ContactMapper', () => {
  let mapper: ContactMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ContactMapper] });
    mapper = TestBed.inject(ContactMapper);
  });

  const mockId = URN.parse('urn:contacts:user:alice');

  it('should map to Domain', () => {
    const record: StorableContact = {
      id: mockId.toString(),
      alias: 'Alice',
      firstName: 'Alice',
      surname: 'W',
      email: 'a@a.com',
      emailAddresses: ['a@a.com'],
      phoneNumbers: [],
      lastModified: '2023-01-01T00:00:00Z' as ISODateTimeString,
    };

    const domain = mapper.toDomain(record);

    expect(domain.id.toString()).toBe(mockId.toString());
  });

  it('should map to Storable', () => {
    const domain: Contact = {
      id: mockId,
      alias: 'Alice',
      firstName: 'Alice',
      surname: 'W',
      email: 'a@a.com',
      emailAddresses: ['a@a.com'],
      phoneNumbers: [],
      serviceContacts: {},
      lastModified: '2023-01-01T00:00:00Z' as ISODateTimeString,
    };

    const record = mapper.toStorable(domain);

    expect(record.id).toBe(mockId.toString());
    expect(record.alias).toBe('Alice');
    // Ensure no made-up fields like 'isFavorite' are asserted
    expect((record as any).isFavorite).toBeUndefined();
  });
});
