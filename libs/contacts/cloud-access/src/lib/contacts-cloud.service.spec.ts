import { TestBed } from '@angular/core/testing';
import { ContactsCloudService } from './contacts-cloud.service';
import {
  ContactsStorageService,
  BlockedIdentity,
} from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';
import {
  CLOUD_PROVIDERS,
  CloudStorageProvider,
} from '@nx-platform-application/platform-cloud-access';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

describe('ContactsCloudService', () => {
  let service: ContactsCloudService;
  let storage: ContactsStorageService;

  const mockProvider: CloudStorageProvider = {
    providerId: 'mock-drive',
    displayName: 'Mock Drive',
    requestAccess: vi.fn(),
    hasPermission: vi.fn(),
    revokeAccess: vi.fn(),
    listBackups: vi.fn(),
    uploadBackup: vi.fn(),
    downloadBackup: vi.fn(),
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
  };

  const mockBlocked: BlockedIdentity[] = [
    {
      urn: URN.parse('urn:contacts:user:pest'),
      blockedAt: '2023-01-01T00:00:00Z' as ISODateTimeString,
      scopes: ['all'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ContactsCloudService,
        MockProvider(ContactsStorageService, {
          contacts$: of([{ id: 'c1' } as any]),
          groups$: of([]),
          blocked$: of(mockBlocked), // ✅ Mock Blocked Stream
          bulkUpsert: vi.fn().mockResolvedValue(undefined),
          saveGroup: vi.fn().mockResolvedValue(undefined),
          blockIdentity: vi.fn().mockResolvedValue(undefined), // ✅ Mock Block Method
        }),
        MockProvider(Logger),
        { provide: CLOUD_PROVIDERS, useValue: [mockProvider] },
      ],
    });

    service = TestBed.inject(ContactsCloudService);
    storage = TestBed.inject(ContactsStorageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Backup', () => {
    it('should snapshot data (including blocked) and upload via provider', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);

      await service.backupToCloud('mock-drive');

      expect(mockProvider.uploadBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          contacts: [{ id: 'c1' }],
          groups: [],
          blocked: mockBlocked, // ✅ Assertion
          version: 5,
        }),
        expect.stringContaining('contacts_backup_')
      );
    });
  });

  describe('Restore', () => {
    it('should download and merge data (including blocked) into storage', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);
      const mockPayload = {
        version: 5,
        contacts: [{ id: 'restored-1' }],
        groups: [{ id: 'g1' }],
        blocked: mockBlocked, // ✅ Payload
      };
      // Use downloadFile as per updated implementation
      vi.spyOn(mockProvider, 'downloadFile').mockResolvedValue(mockPayload);

      await service.restoreFromCloud('mock-drive', 'file-123');

      expect(mockProvider.downloadFile).toHaveBeenCalledWith(
        expect.stringContaining('file-123')
      );
      expect(storage.bulkUpsert).toHaveBeenCalledWith(mockPayload.contacts);
      expect(storage.saveGroup).toHaveBeenCalledWith(mockPayload.groups[0]);

      // ✅ Verify Blocked Restore
      expect(storage.blockIdentity).toHaveBeenCalledWith(
        mockBlocked[0].urn,
        mockBlocked[0].scopes,
        undefined
      );
    });
  });
});
