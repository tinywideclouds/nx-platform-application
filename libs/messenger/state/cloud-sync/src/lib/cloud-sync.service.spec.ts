import { TestBed } from '@angular/core/testing';
import { CloudSyncService } from './cloud-sync.service';
import { ContactsSyncService } from '@nx-platform-application/contacts-sync';
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';

describe('CloudSyncService (Orchestrator)', () => {
  let service: CloudSyncService;
  let contactsSync: ContactsSyncService;
  let chatSync: ChatSyncService;
  let storage: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        CloudSyncService,
        MockProvider(ContactsSyncService, {
          restore: vi.fn().mockResolvedValue(undefined),
          backup: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatSyncService, {
          syncMessages: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(StorageService, {
          connect: vi.fn().mockResolvedValue(true),
          isConnected: signal(true),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(CloudSyncService);
    contactsSync = TestBed.inject(ContactsSyncService);
    chatSync = TestBed.inject(ChatSyncService);
    storage = TestBed.inject(StorageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('syncNow', () => {
    it('should fail immediately if Storage is not connected', async () => {
      (storage.isConnected as any).set(false);

      const result = await service.syncNow({
        providerId: 'google',
        syncContacts: true,
        syncMessages: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No storage connected');
      expect(contactsSync.restore).not.toHaveBeenCalled();
    });

    it('should run BOTH syncs if connected', async () => {
      const result = await service.syncNow({
        providerId: 'google',
        syncContacts: true,
        syncMessages: true,
      });

      // Contacts Flow
      expect(contactsSync.restore).toHaveBeenCalled();
      expect(contactsSync.backup).toHaveBeenCalled();

      // Messenger Flow
      expect(chatSync.syncMessages).toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.contactsProcessed).toBe(true);
      expect(result.messagesProcessed).toBe(true);
    });

    it('should handle partial failures', async () => {
      // Contacts Fails
      vi.spyOn(contactsSync, 'restore').mockRejectedValue(
        new Error('Network Error'),
      );

      const result = await service.syncNow({
        providerId: 'google',
        syncContacts: true,
        syncMessages: true,
      });

      // Contacts processed = false
      expect(result.contactsProcessed).toBe(false);
      expect(result.errors[0]).toContain('Contacts: Network Error');

      // Messenger processed = true (should still run)
      expect(chatSync.syncMessages).toHaveBeenCalled();
      expect(result.messagesProcessed).toBe(true);

      // Overall success is true (we don't crash on partials)
      expect(result.success).toBe(true);
    });
  });
});
