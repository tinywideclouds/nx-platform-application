import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { DirectoryService } from './directory.service';
import { DirectoryStorageService } from '@nx-platform-application/directory-infrastructure-storage';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { DirectoryGroup } from '@nx-platform-application/directory-types';

// Mock Data
const now = Temporal.Now.instant().toString();
const mockGroupUrn = URN.parse('urn:directory:group:123');
const mockUserUrn = URN.parse('urn:directory:entity:bob');
const mockDomainGroup: DirectoryGroup = {
  id: mockGroupUrn,
  members: [
    {
      id: mockUserUrn,
      type: URN.parse('urn:directory:type:user'),
      lastSeenAt: now as ISODateTimeString,
    },
  ],
  memberState: { [mockUserUrn.toString()]: 'joined' },
  lastUpdated: now as ISODateTimeString,
};

describe('DirectoryService', () => {
  let service: DirectoryService;
  let mockStorage: DirectoryStorageService;

  beforeEach(() => {
    // 1. Create Mock implementation
    mockStorage = {
      saveEntity: vi.fn(),
      saveGroup: vi.fn(),
      getEntity: vi.fn(),
      getEntities: vi.fn(),
      getGroup: vi.fn(),
      getGroupMetadata: vi.fn(),
      updateMemberStatus: vi.fn(),
    } as unknown as DirectoryStorageService;

    // 2. Configure Bed
    TestBed.configureTestingModule({
      providers: [
        DirectoryService,
        { provide: DirectoryStorageService, useValue: mockStorage },
      ],
    });

    service = TestBed.inject(DirectoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- QUERY DELEGATION ---

  describe('Delegation (Reads)', () => {
    it('should delegate getEntity', async () => {
      await service.getEntity(mockUserUrn);
      expect(mockStorage.getEntity).toHaveBeenCalledWith(mockUserUrn);
    });

    it('should delegate getGroup', async () => {
      await service.getGroup(mockGroupUrn);
      expect(mockStorage.getGroup).toHaveBeenCalledWith(mockGroupUrn);
    });
  });

  // --- MUTATION DELEGATION ---

  describe('Delegation (Writes)', () => {
    it('should delegate saveGroup', async () => {
      await service.saveGroup(mockDomainGroup);
      expect(mockStorage.saveGroup).toHaveBeenCalledWith(mockDomainGroup);
    });

    it('should delegate updateMemberStatus with Timestamp', async () => {
      // Act
      await service.updateMemberStatus(mockGroupUrn, mockUserUrn, 'left');

      // Assert
      expect(mockStorage.updateMemberStatus).toHaveBeenCalledWith(
        mockGroupUrn,
        mockUserUrn,
        'left',
        expect.any(String), // We verify it adds a timestamp
      );
    });
  });
});
