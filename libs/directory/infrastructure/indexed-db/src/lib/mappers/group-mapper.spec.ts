import { DirectoryGroupMapper } from './group.mapper';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { DirectoryEntity } from '@nx-platform-application/directory-types';

describe('DirectoryGroupMapper', () => {
  let mapper: DirectoryGroupMapper;

  beforeEach(() => {
    mapper = new DirectoryGroupMapper();
  });

  // Strict 4-part URNs
  const mockMemberId = URN.parse('urn:directory:entity:1');
  const mockMemberType = URN.parse('urn:directory:type:user');

  const mockMember: DirectoryEntity = {
    id: mockMemberId,
    type: mockMemberType,
    lastSeenAt: '2023-01-01T00:00:00Z' as ISODateTimeString,
  };

  it('should map to Domain (Hydration)', () => {
    const record = {
      urn: 'urn:directory:group:abc', // Strict 4-part URN
      memberState: { 'urn:directory:entity:1': 'joined' as const },
      memberUrns: ['urn:directory:entity:1'],
      lastUpdated: '2023-01-01T00:00:00Z',
    };

    const domain = mapper.toDomain(record, [mockMember]);

    expect(domain.id.toString()).toBe('urn:directory:group:abc');
    expect(domain.members).toHaveLength(1);
    expect(domain.members[0]).toBe(mockMember);
    expect(domain.memberState['urn:directory:entity:1']).toBe('joined');
  });

  it('should map to Storable (Flattening)', () => {
    const domain = {
      id: URN.parse('urn:directory:group:abc'),
      members: [mockMember],
      memberState: { 'urn:directory:entity:1': 'joined' as const },
      lastUpdated: '2023-01-01T00:00:00Z' as ISODateTimeString,
    };

    const record = mapper.toStorable(domain);

    expect(record.urn).toBe('urn:directory:group:abc');
    expect(record.memberUrns).toEqual(['urn:directory:entity:1']);
    expect(record.memberState).toEqual(domain.memberState);
  });
});
