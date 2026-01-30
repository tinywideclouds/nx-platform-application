import { TestBed } from '@angular/core/testing';
import { ChatSyncService } from './chat-sync.service';
import { ChatVaultEngine } from './internal/chat-vault-engine.service';
import { HistoryReader } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';

describe('ChatSyncService (Domain Facade)', () => {
  let service: ChatSyncService;
  let engine: ChatVaultEngine;
  let storage: StorageService;
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatSyncService,
        MockProvider(ChatVaultEngine, {
          restore: vi.fn().mockResolvedValue(undefined),
          backup: vi.fn().mockResolvedValue(undefined),
          restoreHistory: vi.fn().mockResolvedValue(0),
        }),
        MockProvider(StorageService, {
          isConnected: signal(true),
        }),
        MockProvider(HistoryReader, {
          getAllConversations: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(Logger, {
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
        }),
      ],
    });

    service = TestBed.inject(ChatSyncService);
    engine = TestBed.inject(ChatVaultEngine);
    storage = TestBed.inject(StorageService);
    logger = TestBed.inject(Logger);
  });

  describe('syncMessages', () => {
    it('should return false if Storage is not connected', async () => {
      (storage.isConnected as any).set(false);

      const result = await service.syncMessages();

      expect(result).toBe(false);
      expect(engine.restore).not.toHaveBeenCalled();
    });

    it('should execute full pipeline (Restore -> Backup) on success', async () => {
      const result = await service.syncMessages();

      expect(result).toBe(true);
      expect(engine.restore).toHaveBeenCalled();
      expect(engine.backup).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(engine, 'restore').mockRejectedValue(new Error('Network Fail'));

      const result = await service.syncMessages();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
      expect(service.isSyncing()).toBe(false); // Reset state
    });
  });

  describe('restoreVaultForDate (Deep History)', () => {
    const urn = URN.parse('urn:messenger:group:123');
    const date = '2024-01-01';

    it('should abort if Cloud is disabled', async () => {
      (storage.isConnected as any).set(false);

      const count = await service.restoreVaultForDate(date, urn);

      expect(count).toBe(0);
      expect(engine.restoreHistory).not.toHaveBeenCalled();
    });

    it('should delegate to engine.restoreHistory and return count', async () => {
      vi.spyOn(engine, 'restoreHistory').mockResolvedValue(15);

      // Check syncing state during execution
      const promise = service.restoreVaultForDate(date, urn);
      expect(service.isSyncing()).toBe(true);

      const count = await promise;
      expect(count).toBe(15);
      expect(engine.restoreHistory).toHaveBeenCalledWith(date, urn);
      expect(service.isSyncing()).toBe(false); // Reset
    });

    it('should handle failures without crashing', async () => {
      vi.spyOn(engine, 'restoreHistory').mockRejectedValue(new Error('404'));

      const count = await service.restoreVaultForDate(date, urn);

      expect(count).toBe(0);
      expect(logger.error).toHaveBeenCalled();
      expect(service.isSyncing()).toBe(false);
    });
  });

  describe('performSync (Compatibility)', () => {
    it('should delegate to syncMessages if syncMessages=true', async () => {
      vi.spyOn(service, 'syncMessages').mockResolvedValue(true);

      await service.performSync({ providerId: 'google', syncMessages: true });

      expect(service.syncMessages).toHaveBeenCalled();
    });
  });
});
