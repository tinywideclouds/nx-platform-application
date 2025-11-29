// libs/contacts/cloud-access/src/lib/contacts-cloud.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { ContactsCloudService } from './contacts-cloud.service';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';
import {
  CLOUD_PROVIDERS,
  CloudStorageProvider,
} from '@nx-platform-application/platform-cloud-access';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';

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

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ContactsCloudService,
        MockProvider(ContactsStorageService, {
          contacts$: of([{ id: 'c1' } as any]),
          groups$: of([]),
          bulkUpsert: vi.fn().mockResolvedValue(undefined),
          saveGroup: vi.fn().mockResolvedValue(undefined),
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
    it('should snapshot data and upload via provider', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);

      await service.backupToCloud('mock-drive');

      expect(mockProvider.uploadBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          contacts: [{ id: 'c1' }],
          groups: [],
          version: 4,
        }),
        expect.stringContaining('contacts_backup_')
      );
    });

    it('should request permission if not granted', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(false);
      vi.spyOn(mockProvider, 'requestAccess').mockResolvedValue(true);

      await service.backupToCloud('mock-drive');

      expect(mockProvider.requestAccess).toHaveBeenCalled();
      expect(mockProvider.uploadBackup).toHaveBeenCalled();
    });

    it('should throw if permission denied', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(false);
      vi.spyOn(mockProvider, 'requestAccess').mockResolvedValue(false);

      await expect(service.backupToCloud('mock-drive')).rejects.toThrow(
        'User denied'
      );
    });
  });

  describe('Restore', () => {
    it('should download and merge data into storage', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);
      const mockPayload = {
        version: 4,
        contacts: [{ id: 'restored-1' }],
        groups: [{ id: 'g1' }],
      };
      vi.spyOn(mockProvider, 'downloadBackup').mockResolvedValue(mockPayload);

      await service.restoreFromCloud('mock-drive', 'file-123');

      expect(mockProvider.downloadBackup).toHaveBeenCalledWith('file-123');
      expect(storage.bulkUpsert).toHaveBeenCalledWith(mockPayload.contacts);
      expect(storage.saveGroup).toHaveBeenCalledWith(mockPayload.groups[0]);
    });
  });

  describe('List', () => {
    it('should delegate to provider with prefix', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(true);
      await service.listBackups('mock-drive');
      expect(mockProvider.listBackups).toHaveBeenCalledWith('contacts_backup_');
    });
  });
});
