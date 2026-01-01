import { TestBed } from '@angular/core/testing';
import { ChatSyncService } from './chat-sync.service';
import { ChatVaultEngine } from './internal/chat-vault-engine.service';
import { HistoryReader } from '@nx-platform-application/messenger-domain-conversation';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import { signal } from '@angular/core';

describe('ChatSyncService (Domain Facade)', () => {
  let service: ChatSyncService;
  let engine: ChatVaultEngine;
  let historyReader: HistoryReader;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatSyncService,
        MockProvider(ChatVaultEngine, {
          connect: vi.fn().mockResolvedValue(true),
          restoreIndex: vi.fn().mockResolvedValue(undefined),
          backup: vi.fn().mockResolvedValue(undefined),
          isCloudEnabled: signal(true),
          restoreVaultForDate: vi.fn().mockResolvedValue(10),
        }),
        MockProvider(HistoryReader, {
          getConversationSummaries: vi.fn().mockResolvedValue([]),
          getMessages: vi.fn().mockResolvedValue({ messages: [] }),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ChatSyncService);
    engine = TestBed.inject(ChatVaultEngine);
    historyReader = TestBed.inject(HistoryReader);
  });

  describe('syncMessages', () => {
    it('should return false if Engine fails to connect', async () => {
      vi.mocked(engine.connect).mockResolvedValue(false);
      const result = await service.syncMessages('google');
      expect(result).toBe(false);
    });

    it('should execute full pipeline on success', async () => {
      vi.mocked(engine.connect).mockResolvedValue(true);
      const result = await service.syncMessages('google');
      expect(result).toBe(true);
      expect(engine.connect).toHaveBeenCalledWith('google');
      expect(engine.backup).toHaveBeenCalledWith('google');
    });
  });

  describe('performSync (Compatibility)', () => {
    it('should delegate to syncMessages if syncMessages=true', async () => {
      vi.spyOn(service, 'syncMessages').mockResolvedValue(true);

      await service.performSync({ providerId: 'google', syncMessages: true });

      expect(service.syncMessages).toHaveBeenCalledWith('google');
    });

    it('should skip if syncMessages=false', async () => {
      vi.spyOn(service, 'syncMessages');

      const result = await service.performSync({
        providerId: 'google',
        syncMessages: false,
      });

      expect(service.syncMessages).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
