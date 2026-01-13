import { TestBed } from '@angular/core/testing';
import { ChatSyncService } from './chat-sync.service';
import { ChatVaultEngine } from './internal/chat-vault-engine.service';
import { HistoryReader } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';

describe('ChatSyncService (Domain Facade)', () => {
  let service: ChatSyncService;
  let engine: ChatVaultEngine;
  let storage: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatSyncService,
        MockProvider(ChatVaultEngine, {
          restore: vi.fn().mockResolvedValue(undefined),
          backup: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(StorageService, {
          isConnected: signal(true),
        }),
        MockProvider(HistoryReader, {
          getConversationSummaries: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ChatSyncService);
    engine = TestBed.inject(ChatVaultEngine);
    storage = TestBed.inject(StorageService);
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
  });

  describe('performSync (Compatibility)', () => {
    it('should delegate to syncMessages if syncMessages=true', async () => {
      vi.spyOn(service, 'syncMessages').mockResolvedValue(true);

      await service.performSync({ providerId: 'google', syncMessages: true });

      expect(service.syncMessages).toHaveBeenCalled();
    });
  });
});
