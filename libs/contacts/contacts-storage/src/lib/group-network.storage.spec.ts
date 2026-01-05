import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GroupNetworkStorage } from './group-network.storage';
import {
  ContactsDatabase,
  StorableGroup,
} from '@nx-platform-application/contacts-persistence';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

// Mock DB
const { mockDb } = vi.hoisted(() => {
  const table = {
    get: vi.fn(),
    update: vi.fn(), // Critical for status updates
  };
  return {
    mockDb: {
      groups: table,
      transaction: vi.fn(async (_, __, cb) => cb()),
    },
  };
});

const mockGroupUrn = URN.parse('urn:contacts:group:abc');
const mockUserUrn = URN.parse('urn:contacts:user:bob');

const mockStorableGroup: StorableGroup = {
  id: mockGroupUrn.toString(),
  name: 'Test Group',
  description: '',
  scope: 'messenger',
  contactIds: ['urn:contacts:user:bob'],
  members: [
    {
      contactId: 'urn:contacts:user:bob',
      status: 'invited',
      joinedAt: undefined,
    },
  ],
  lastModified: '2023-01-01T00:00:00Z' as ISODateTimeString,
};

describe('GroupNetworkStorage', () => {
  let service: GroupNetworkStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        GroupNetworkStorage,
        { provide: ContactsDatabase, useValue: mockDb },
      ],
    });
    service = TestBed.inject(GroupNetworkStorage);
    mockDb.groups.get.mockResolvedValue(mockStorableGroup);
  });

  it('should atomically update member status to JOINED', async () => {
    await service.updateGroupMemberStatus(mockGroupUrn, mockUserUrn, 'joined');

    // 1. Verify Transaction Scope
    expect(mockDb.transaction).toHaveBeenCalledWith(
      'rw',
      mockDb.groups,
      expect.any(Function),
    );

    // 2. Verify Update Call
    expect(mockDb.groups.update).toHaveBeenCalledWith(
      mockGroupUrn.toString(),
      expect.objectContaining({
        members: expect.arrayContaining([
          expect.objectContaining({
            contactId: mockUserUrn.toString(),
            status: 'joined',
            // joinedAt should be set to a new timestamp (string), not undefined
            joinedAt: expect.any(String),
          }),
        ]),
      }),
    );
  });

  it('should ignore update if group does not exist', async () => {
    mockDb.groups.get.mockResolvedValue(undefined);
    await service.updateGroupMemberStatus(mockGroupUrn, mockUserUrn, 'joined');
    expect(mockDb.groups.update).not.toHaveBeenCalled();
  });
});
