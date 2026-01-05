import { TestBed } from '@angular/core/testing';
import { ContactsCloudService } from './contacts-cloud.service';
// ✅ Import Concrete Storage Classes
import {
  ContactsStorageService,
  GatekeeperStorage,
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
import { BlockedIdentity } from '@nx-platform-application/contacts-types';

describe('ContactsCloudService', () => {
  let service: ContactsCloudService;
  let storage: ContactsStorageService;
  let gatekeeper: GatekeeperStorage;

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
        // 1. Mock Address Book Storage
        MockProvider(ContactsStorageService, {
          contacts$: of([{ id: 'c1' } as any]),
          groups$: of([]),
          bulkUpsert: vi.fn().mockResolvedValue(undefined),
          saveGroup: vi.fn().mockResolvedValue(undefined),
        }),
        // 2. Mock Gatekeeper Storage (Concrete)
        MockProvider(GatekeeperStorage, {
          blocked$: of(mockBlocked),
          blockIdentity: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(Logger),
        { provide: CLOUD_PROVIDERS, useValue: [mockProvider] },
      ],
    });

    service = TestBed.inject(ContactsCloudService);
    storage = TestBed.inject(ContactsStorageService);
    gatekeeper = TestBed.inject(GatekeeperStorage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Backup', () => {
    it('should snapshot data (Address Book + Gatekeeper) and upload', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);

      await service.backupToCloud('mock-drive');

      expect(mockProvider.uploadBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          contacts: [{ id: 'c1' }],
          groups: [],
          blocked: mockBlocked, // Verified from DexieGatekeeperStorage
          version: 5,
        }),
        expect.stringContaining('contacts_backup_'),
      );
    });
  });

  describe('Restore', () => {
    it('should restore data to respective storage services', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);
      const mockPayload = {
        version: 5,
        contacts: [{ id: 'restored-1' }],
        groups: [{ id: 'g1' }],
        blocked: mockBlocked,
      };

      vi.spyOn(mockProvider, 'downloadFile').mockResolvedValue(mockPayload);

      await service.restoreFromCloud('mock-drive', 'file-123');

      // Verify Address Book Restore
      expect(storage.bulkUpsert).toHaveBeenCalledWith(mockPayload.contacts);
      expect(storage.saveGroup).toHaveBeenCalledWith(mockPayload.groups[0]);

      // Verify Gatekeeper Restore (Concrete Call)
      expect(gatekeeper.blockIdentity).toHaveBeenCalledWith(
        mockBlocked[0].urn,
        mockBlocked[0].scopes,
        undefined,
      );
    });
  });
});
