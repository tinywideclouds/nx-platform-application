import { TestBed } from '@angular/core/testing';
import { GroupMapper } from './group.mapper';
import { URN } from '@nx-platform-application/platform-types';
import { ContactGroup } from '@nx-platform-application/contacts-types';
import { StorableGroup } from '../records/group.record';

describe('GroupMapper', () => {
  let mapper: GroupMapper;

  const mockMemberId = URN.parse('urn:contacts:user:bob');
  const mockGroupId = URN.parse('urn:contacts:group:family');

  const mockDomainGroup: ContactGroup = {
    id: mockGroupId,
    name: 'Family Chat',
    description: 'The fam',
    scope: 'messenger',
    parentId: URN.parse('urn:contacts:group:template'),
    members: [
      {
        contactId: mockMemberId,
        status: 'joined',
        joinedAt: '2023-01-01T00:00:00Z' as any,
      },
    ],
  };

  const mockStorableGroup: StorableGroup = {
    id: 'urn:contacts:group:family',
    name: 'Family Chat',
    description: 'The fam',
    scope: 'messenger',
    parentId: 'urn:contacts:group:template',
    contactIds: ['urn:contacts:user:bob'], // 👈 The critical index
    members: [
      {
        contactId: 'urn:contacts:user:bob',
        status: 'joined',
        joinedAt: '2023-01-01T00:00:00Z' as any,
      },
    ],
    lastModified: '2023-01-01T00:00:00Z' as any,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GroupMapper],
    });
    mapper = TestBed.inject(GroupMapper);
  });

  describe('toStorable', () => {
    it('should correctly map simple fields', () => {
      const result = mapper.toStorable(mockDomainGroup);
      expect(result.id).toBe(mockDomainGroup.id.toString());
      expect(result.name).toBe(mockDomainGroup.name);
      expect(result.scope).toBe('messenger');
    });

    it('🚨 CRITICAL: should map members to a flat array of strings for indexing', () => {
      // This test ensures we don't accidentally save "[object Object]" into the index
      const result = mapper.toStorable(mockDomainGroup);

      expect(Array.isArray(result.contactIds)).toBe(true);
      expect(result.contactIds.length).toBe(1);
      expect(result.contactIds[0]).toBe('urn:contacts:user:bob');
      expect(typeof result.contactIds[0]).toBe('string');
    });

    it('should map rich member objects for storage', () => {
      const result = mapper.toStorable(mockDomainGroup);
      expect(result.members[0].contactId).toBe('urn:contacts:user:bob');
      expect(result.members[0].status).toBe('joined');
    });
  });

  describe('toDomain', () => {
    it('should rehydrate URNs from strings', () => {
      const result = mapper.toDomain(mockStorableGroup);

      expect(result.id).toBeInstanceOf(URN);
      expect(result.id.toString()).toBe('urn:contacts:group:family');

      expect(result.parentId).toBeInstanceOf(URN);
      expect(result.members[0].contactId).toBeInstanceOf(URN);
    });

    it('should handle missing optional parentId', () => {
      const noParent = { ...mockStorableGroup, parentId: undefined };
      const result = mapper.toDomain(noParent);
      expect(result.parentId).toBeUndefined();
    });
  });
});
