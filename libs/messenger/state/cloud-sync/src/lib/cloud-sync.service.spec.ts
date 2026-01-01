import { TestBed } from '@angular/core/testing';
import { CloudSyncService } from './cloud-sync.service';
import { ContactsCloudService } from '@nx-platform-application/contacts-cloud-access';
// 1. UPDATE IMPORT
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import {
  CLOUD_PROVIDERS,
  CloudStorageProvider,
} from '@nx-platform-application/platform-cloud-access';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('CloudSyncService (Orchestrator)', () => {
  let service: CloudSyncService;
  let chatSync: ChatSyncService;

  const mockProvider: CloudStorageProvider = {
    providerId: 'google',
    displayName: 'Google Drive',
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
        CloudSyncService,
        MockProvider(ContactsCloudService, {
          listBackups: vi.fn().mockResolvedValue([]),
          restoreFromCloud: vi.fn().mockResolvedValue(undefined),
          backupToCloud: vi.fn().mockResolvedValue(undefined),
        }),
        // 2. MOCK THE NEW DOMAIN SERVICE
        MockProvider(ChatSyncService, {
          syncMessages: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(Logger),
        { provide: CLOUD_PROVIDERS, useValue: [mockProvider] },
      ],
    });

    service = TestBed.inject(CloudSyncService);
    chatSync = TestBed.inject(ChatSyncService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ... (Connect tests remain unchanged) ...

  describe('syncNow', () => {
    it('should Authenticate ONCE and run BOTH syncs', async () => {
      vi.spyOn(mockProvider, 'hasPermission').mockReturnValue(false);
      vi.spyOn(mockProvider, 'requestAccess').mockResolvedValue(true);

      const result = await service.syncNow({
        providerId: 'google',
        syncContacts: true,
        syncMessages: true,
      });

      // Assert Auth
      expect(mockProvider.requestAccess).toHaveBeenCalledTimes(1);

      // Assert Messenger Flow
      // 3. VERIFY NEW CALL
      expect(chatSync.syncMessages).toHaveBeenCalledWith('google');

      expect(result.success).toBe(true);
    });
  });
});
