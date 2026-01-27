import { TestBed } from '@angular/core/testing';
import { DirectoryStorageService } from './directory-storage.service';
import {
  DirectoryDatabase,
  DirectoryEntityMapper,
  DirectoryGroupMapper,
} from '@nx-platform-application/directory-infrastructure-indexed-db';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  DirectoryEntity,
  DirectoryGroup,
} from '@nx-platform-application/directory-types';
import 'fake-indexeddb/auto'; // Ensures Dexie runs in memory
import { Dexie } from 'dexie';

describe('DirectoryStorageService', () => {
  let service: DirectoryStorageService;
  let db: DirectoryDatabase;

  // --- Test Data Helpers ---
  const member1Urn = URN.parse('urn:directory:entity:alice');
  const member2Urn = URN.parse('urn:directory:entity:bob');
  const groupUrn = URN.parse('urn:directory:group:chat');

  const member1: DirectoryEntity = {
    id: member1Urn,
    type: URN.parse('urn:directory:type:user'),
    lastSeenAt: '2023-01-01T10:00:00Z' as ISODateTimeString,
  };

  const member2: DirectoryEntity = {
    id: member2Urn,
    type: URN.parse('urn:directory:type:user'),
    lastSeenAt: '2023-01-01T11:00:00Z' as ISODateTimeString,
  };

  const testGroup: DirectoryGroup = {
    id: groupUrn,
    members: [member1, member2],
    memberState: {
      [member1Urn.toString()]: 'joined',
      [member2Urn.toString()]: 'joined',
    },
    lastUpdated: '2023-01-01T12:00:00Z' as ISODateTimeString,
  };

  beforeEach(async () => {
    // 1. Reset DB for isolation
    await Dexie.delete('directory');

    // 2. Configure Bed
    TestBed.configureTestingModule({
      providers: [
        DirectoryStorageService,
        DirectoryDatabase,
        DirectoryEntityMapper,
        DirectoryGroupMapper,
      ],
    });

    service = TestBed.inject(DirectoryStorageService);
    db = TestBed.inject(DirectoryDatabase);
    await db.open();
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('saveGroup', () => {
    it('should save group and all members transactionally', async () => {
      // Act
      await service.saveGroup(testGroup);

      // Assert - Check Raw DB
      const storedGroup = await db.groups.get(groupUrn.toString());
      const storedMember1 = await db.entities.get(member1Urn.toString());
      const storedMember2 = await db.entities.get(member2Urn.toString());

      // Verify Group Data
      expect(storedGroup).toBeDefined();
      expect(storedGroup?.memberUrns).toContain(member1Urn.toString());
      expect(storedGroup?.memberUrns).toContain(member2Urn.toString());

      // Verify Entity Data (Cascading Save)
      expect(storedMember1).toBeDefined();
      expect(storedMember1?.urn).toBe(member1Urn.toString());
      expect(storedMember2).toBeDefined();
    });
  });

  describe('getGroup', () => {
    it('should retrieve group and hydrate members', async () => {
      // Arrange: Save data first
      await service.saveGroup(testGroup);

      // Act
      const retrieved = await service.getGroup(groupUrn);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved?.id.toString()).toBe(groupUrn.toString());
      expect(retrieved?.members.length).toBe(2);

      // Verify Hydration Logic
      const retrievedIds = retrieved?.members.map((m) => m.id.toString());
      expect(retrievedIds).toContain(member1Urn.toString());
      expect(retrievedIds).toContain(member2Urn.toString());
    });

    it('should return undefined for missing group', async () => {
      const result = await service.getGroup(
        URN.parse('urn:directory:group:missing'),
      );
      expect(result).toBeUndefined();
    });
  });

  describe('getGroupMetadata', () => {
    it('should return member count without full hydration', async () => {
      // Arrange
      await service.saveGroup(testGroup);

      // Act
      const metadata = await service.getGroupMetadata(groupUrn);

      // Assert
      expect(metadata.memberCount).toBe(2);
    });
  });
});
