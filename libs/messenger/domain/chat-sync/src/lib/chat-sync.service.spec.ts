import { TestBed } from '@angular/core/testing';
import { ChatSyncService } from './chat-sync.service';
import { CloudSyncService } from '@nx-platform-application/messenger-cloud-sync';
import { ChatMessageRepository } from '@nx-platform-application/chat-message-repository';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

describe('ChatSyncService', () => {
  let service: ChatSyncService;

  const mockCloudSync = {
    syncNow: vi.fn(),
  };
  const mockStorage = {
    loadConversationSummaries: vi.fn(),
  };
  const mockRepository = {
    getMessages: vi.fn(),
  };
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatSyncService,
        MockProvider(CloudSyncService, mockCloudSync),
        MockProvider(ChatMessageRepository, mockRepository),
        MockProvider(ChatStorageService, mockStorage),
        MockProvider(ContactsStorageService),
        MockProvider(Logger, mockLogger),
      ],
    });

    service = TestBed.inject(ChatSyncService);
  });

  describe('performSync', () => {
    it('should return false if CloudSync fails', async () => {
      mockCloudSync.syncNow.mockResolvedValue({
        success: false,
        errors: ['Auth failed'],
      });

      const result = await service.performSync({
        providerId: 'google',
        syncContacts: true,
        syncMessages: true,
      });

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
      // Should NOT trigger hydration on failure
      expect(mockStorage.loadConversationSummaries).not.toHaveBeenCalled();
    });

    it('should return true and trigger hydration on success', async () => {
      mockCloudSync.syncNow.mockResolvedValue({ success: true });
      mockStorage.loadConversationSummaries.mockResolvedValue([]); // No chats, but method called

      const result = await service.performSync({
        providerId: 'google',
        syncContacts: true,
        syncMessages: true,
      });

      expect(result).toBe(true);
      // Hydration triggered
      expect(mockStorage.loadConversationSummaries).toHaveBeenCalled();
    });

    it('should hydrate TOP 5 chats sequentially', async () => {
      mockCloudSync.syncNow.mockResolvedValue({ success: true });

      // Mock 6 conversations
      const mockSummaries = Array.from({ length: 6 }, (_, i) => ({
        conversationUrn: URN.parse(`urn:contacts:user:${i}`),
      }));
      mockStorage.loadConversationSummaries.mockResolvedValue(mockSummaries);
      mockRepository.getMessages.mockResolvedValue({ messages: [] });

      await service.performSync({
        providerId: 'google',
        syncContacts: false,
        syncMessages: true,
      });

      // Wait for the background promise (since it's not awaited in the service)
      await vi.waitFor(() => {
        expect(mockRepository.getMessages).toHaveBeenCalledTimes(5);
      });

      // Verify limits
      expect(mockRepository.getMessages).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });
  });
});
