import { DirectoryEntity } from '@nx-platform-application/directory-types';
import { StorableDirectoryEntity } from '../records/directory.record';
import { DirectoryEntityMapper } from './entity-mapper';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

describe('DirectoryEntityMapper', () => {
  let mapper: DirectoryEntityMapper;

  beforeEach(() => {
    mapper = new DirectoryEntityMapper();
  });

  it('should map to Domain', () => {
    const record: StorableDirectoryEntity = {
      urn: 'urn:directory:entity:123',
      type: 'urn:directory:type:user',
      lastAccessed: '2023-01-01T00:00:00Z',
    };

    const domain = mapper.toDomain(record);

    expect(domain.id).toBeInstanceOf(URN);
    expect(domain.id.toString()).toBe('urn:directory:entity:123');
    expect(domain.type).toBeInstanceOf(URN);
    expect(domain.lastSeenAt).toBe('2023-01-01T00:00:00Z');
  });

  it('should map to Storable', () => {
    const domain: DirectoryEntity = {
      id: URN.parse('urn:directory:entity:123'),
      type: URN.parse('urn:directory:type:user'),
      lastSeenAt: '2023-01-01T00:00:00Z' as ISODateTimeString,
    };

    const record = mapper.toStorable(domain);

    expect(record.urn).toBe('urn:directory:entity:123');
    expect(record.type).toBe('urn:directory:type:user');
    expect(record.lastAccessed).toBe('2023-01-01T00:00:00Z');
  });
});
