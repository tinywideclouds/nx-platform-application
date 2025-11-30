import { TestBed } from '@angular/core/testing';
import { CloudSyncService } from './cloud-sync.service';
import { ContactsCloudService } from '@nx-platform-application/contacts-cloud-access';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import {
  CLOUD_PROVIDERS,
  CloudStorageProvider,
} from '@nx-platform-application/platform-cloud-access';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi } from 'vitest';

describe('CloudSyncService (Orchestrator)', () => {
  let service: CloudSyncService;
  let contactsCloud: ContactsCloudService;
  let chatCloud: ChatCloudService;

  const mockProvider: CloudStorageProvider = {
    providerId: 'google',
    displayName: 'Google Drive',
    requestAccess: vi.fn(), // Spy target
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
        CloudSyncService,
        MockProvider(ContactsCloudService, {
          listBackups: vi.fn().mockResolvedValue([]),
          restoreFromCloud: vi.fn().mockResolvedValue(undefined),
          backupToCloud: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatCloudService, {
          connect: vi.fn().mockResolvedValue(true),
          restoreIndex: vi.fn().mockResolvedValue(true),
          backup: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(Logger),
        { provide: CLOUD_PROVIDERS, useValue: [mockProvider] },
      ],
    });

    service = TestBed.inject(CloudSyncService);
    contactsCloud = TestBed.inject(ContactsCloudService);
    chatCloud = TestBed.inject(ChatCloudService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connect', () => {
    it('should request correct scopes for CONTACTS only', async () => {
      vi.spyOn(mockProvider, 'requestAccess').mockResolvedValue(true);

      await service.connect('google', {
        syncContacts: true,
        syncMessages: false,
      });

      expect(mockProvider.requestAccess).toHaveBeenCalledWith(
        expect.arrayContaining(['https://www.googleapis.com/auth/contacts'])
      );
      // Should NOT have drive scope if messages are disabled (implementation detail check)
      expect(mockProvider.requestAccess).not.toHaveBeenCalledWith(
        expect.arrayContaining(['https://www.googleapis.com/auth/drive.file'])
      );
    });

    it('should request COMBINED scopes for Contacts and Messages', async () => {
      vi.spyOn(mockProvider, 'requestAccess').mockResolvedValue(true);

      await service.connect('google', {
        syncContacts: true,
        syncMessages: true,
      });

      expect(mockProvider.requestAccess).toHaveBeenCalledWith(
        expect.arrayContaining([
          'https://www.googleapis.com/auth/contacts',
          'https://www.googleapis.com/auth/drive.file',
        ])
      );
    });
  });

  describe('syncNow', () => {
    it('should Authenticate ONCE and run BOTH syncs', async () => {
      // 1. Setup Auth
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(false);
      vi.spyOn(mockProvider, 'requestAccess').mockResolvedValue(true);

      // 2. Action
      const result = await service.syncNow({
        providerId: 'google',
        syncContacts: true,
        syncMessages: true,
      });

      // 3. Assert Auth (Single Request with combined scopes)
      expect(mockProvider.requestAccess).toHaveBeenCalledTimes(1);
      expect(mockProvider.requestAccess).toHaveBeenCalledWith(
        expect.arrayContaining([
          'https://www.googleapis.com/auth/contacts',
          'https://www.googleapis.com/auth/drive.file',
        ])
      );

      // 4. Assert Contacts Flow
      expect(contactsCloud.listBackups).toHaveBeenCalled();
      expect(contactsCloud.backupToCloud).toHaveBeenCalled();

      // 5. Assert Chat Flow
      expect(chatCloud.connect).toHaveBeenCalled();
      expect(chatCloud.restoreIndex).toHaveBeenCalled();
      expect(chatCloud.backup).toHaveBeenCalled();

      expect(result.success).toBe(true);
    });
  });
});
