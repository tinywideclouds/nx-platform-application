// libs/messenger/chat-state/src/lib/services/chat-key.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { ChatKeyService } from './chat-key.service';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

// Services
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { Logger } from '@nx-platform-application/console-logger';

// [Refactor] Use the Adapter Interface
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';

describe('ChatKeyService', () => {
  let service: ChatKeyService;

  // --- Mocks ---
  const mockKeyService = {
    hasKeys: vi.fn(),
    storeKeys: vi.fn(),
  };
  const mockCryptoService = {
    clearKeys: vi.fn(),
    generateAndStoreKeys: vi.fn(),
  };
  const mockResolver = {
    resolveToHandle: vi.fn(),
  };

  // --- Fixtures ---
  const contactUrn = URN.parse('urn:contacts:user:alice');
  const handleUrn = URN.parse('urn:lookup:email:alice@test.com');

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatKeyService,
        MockProvider(KeyCacheService, mockKeyService),
        MockProvider(MessengerCryptoService, mockCryptoService),
        // [Refactor] Mock the Interface
        MockProvider(IdentityResolver, mockResolver),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ChatKeyService);
  });

  // --- 1. Key Check Tests ---

  describe('checkRecipientKeys', () => {
    it('should resolve identity via Resolver and check KeyService', async () => {
      // Mock Resolver behavior
      mockResolver.resolveToHandle.mockResolvedValue(handleUrn);
      mockKeyService.hasKeys.mockResolvedValue(true);

      const result = await service.checkRecipientKeys(contactUrn);

      // Verify delegation
      expect(mockResolver.resolveToHandle).toHaveBeenCalledWith(contactUrn);
      expect(mockKeyService.hasKeys).toHaveBeenCalledWith(handleUrn);
      expect(result).toBe(true);
    });

    it('should log warning/return false if keys are missing', async () => {
      mockResolver.resolveToHandle.mockResolvedValue(handleUrn);
      mockKeyService.hasKeys.mockResolvedValue(false);

      const result = await service.checkRecipientKeys(contactUrn);

      expect(result).toBe(false);
    });

    it('should skip check for Groups/System URNs', async () => {
      const groupUrn = URN.parse('urn:messenger:group:123');
      const result = await service.checkRecipientKeys(groupUrn);

      expect(result).toBe(true);
      expect(mockResolver.resolveToHandle).not.toHaveBeenCalled();
    });
  });

  // --- 2. Reset Identity Tests ---

  describe('resetIdentityKeys', () => {
    it('should wipe, generate, and upload keys (claiming handle)', async () => {
      const myUrn = URN.parse('urn:auth:google:me');
      const myEmail = 'me@test.com';
      const mockKeyResult = { privateKeys: {}, publicKeys: {} };

      mockCryptoService.generateAndStoreKeys.mockResolvedValue(mockKeyResult);

      await service.resetIdentityKeys(myUrn, myEmail);

      // 1. Wipe
      expect(mockCryptoService.clearKeys).toHaveBeenCalled();

      // 2. Generate
      expect(mockCryptoService.generateAndStoreKeys).toHaveBeenCalledWith(
        myUrn
      );

      // 3. Upload Handle Keys (Correct URN construction)
      expect(mockKeyService.storeKeys).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 'me@test.com' }),
        mockKeyResult.publicKeys
      );
    });
  });
});
