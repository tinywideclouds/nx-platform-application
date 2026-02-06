import { TestBed } from '@angular/core/testing';
import { AppState } from './app-state.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

// --- DEPENDENCIES ---
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';
import { ActiveChatFacade } from '@nx-platform-application/messenger-state-active-chat';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { Router } from '@angular/router';

// --- DOMAIN ---
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';
import { AddressBookManagementApi } from '@nx-platform-application/contacts-api';

// ✅ NEW
import { DirectoryManagementApi } from '@nx-platform-application/directory-api';

describe('AppState (Lifecycle)', () => {
  let service: AppState;

  // Mocks
  const mockAuth = { logout: vi.fn().mockResolvedValue(undefined) };
  const mockActiveChat = {
    performHistoryWipe: vi.fn().mockResolvedValue(undefined),
  };
  const mockAddressBook = {
    clearDatabase: vi.fn().mockResolvedValue(undefined),
  };
  const mockDirectory = { clear: vi.fn().mockResolvedValue(undefined) }; // ✅
  const mockSettings = { clear: vi.fn().mockResolvedValue(undefined) };
  const mockRouter = { navigate: vi.fn() };
  const mockOutbox = { stop: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AppState,
        MockProvider(Logger),
        { provide: IAuthService, useValue: mockAuth },
        { provide: ActiveChatFacade, useValue: mockActiveChat },
        { provide: AddressBookManagementApi, useValue: mockAddressBook },
        { provide: DirectoryManagementApi, useValue: mockDirectory }, // ✅
        { provide: Router, useValue: mockRouter },
        { provide: OutboxWorkerService, useValue: mockOutbox },

        // Other required mocks
        MockProvider(ChatIdentityFacade, { performIdentityReset: vi.fn() }),
        MockProvider(ChatModerationFacade),
        MockProvider(ChatMediaFacade),
        MockProvider(CloudSyncService),
        MockProvider(ChatDataService),
        MockProvider(SessionService),
        MockProvider(GroupProtocolService),
      ],
    });

    service = TestBed.inject(AppState);

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
    });
  });

  describe('fullDeviceWipe', () => {
    it('should orchestrate a complete system teardown', async () => {
      await service.fullDeviceWipe();

      // 1. Stop Workers
      expect(mockOutbox.stop).toHaveBeenCalled();

      // 2. Data Destruction
      expect(mockActiveChat.performHistoryWipe).toHaveBeenCalled();
      expect(mockAddressBook.clearDatabase).toHaveBeenCalled();
      expect(mockDirectory.clear).toHaveBeenCalled(); // ✅ Verified

      // 3. Auth Logout
      expect(mockAuth.logout).toHaveBeenCalled();

      // 4. Navigation
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
