import { TestBed } from '@angular/core/testing';
import { GroupMapper } from './group.mapper';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ContactGroup } from '@nx-platform-application/contacts-types';
import { StorableGroup } from '../records/group.record';

describe('GroupMapper', () => {
  let mapper: GroupMapper;

  const mockGroupId = URN.parse('urn:contacts:group:family');
  const mockMemberId = URN.parse('urn:contacts:user:alice');

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [GroupMapper] });
    mapper = TestBed.inject(GroupMapper);
  });

  describe('toDomain', () => {
    it('should map storable record to domain with memberUrns', () => {
      const record: StorableGroup = {
        id: mockGroupId.toString(),
        name: 'Family',
        description: 'Desc',
        contactIds: [mockMemberId.toString()],
        lastModified: '2023-01-01T00:00:00Z',
      };

      // No hydration arguments needed anymore
      const domain = mapper.toDomain(record);

      expect(domain.id.toString()).toBe(mockGroupId.toString());
      expect(domain.memberUrns).toHaveLength(1);
      expect(domain.memberUrns[0].equals(mockMemberId)).toBe(true);
    });
  });

  describe('toStorable', () => {
    it('should map domain memberUrns to storable contactIds', () => {
      const domain: ContactGroup = {
        id: mockGroupId,
        name: 'Family',
        description: 'Desc',
        memberUrns: [mockMemberId],
        lastModified: '' as ISODateTimeString,
      };

      const record = mapper.toStorable(domain);

      expect(record.contactIds).toContain(mockMemberId.toString());
    });
  });
});
