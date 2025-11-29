import { TestBed } from '@angular/core/testing';
import { ChatKeyService } from './chat-key.service';
import { URN } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

// Services
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { Logger } from '@nx-platform-application/console-logger';
import { ContactMessengerMapper } from './contact-messenger.mapper';

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
  const mockLogger = {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };
  const mockMapper = {
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
        { provide: KeyCacheService, useValue: mockKeyService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ContactMessengerMapper, useValue: mockMapper },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(ChatKeyService);
  });

  // --- 1. Key Check Tests ---

  describe('checkRecipientKeys', () => {
    it('should resolve identity via Mapper and check KeyService', async () => {
      // Mock Mapper resolution
      mockMapper.resolveToHandle.mockResolvedValue(handleUrn);
      mockKeyService.hasKeys.mockResolvedValue(true);

      const result = await service.checkRecipientKeys(contactUrn);

      expect(mockMapper.resolveToHandle).toHaveBeenCalledWith(contactUrn);
      expect(mockKeyService.hasKeys).toHaveBeenCalledWith(handleUrn);
      expect(result).toBe(true);
    });

    it('should log warning if keys are missing', async () => {
      mockMapper.resolveToHandle.mockResolvedValue(handleUrn);
      mockKeyService.hasKeys.mockResolvedValue(false);

      const result = await service.checkRecipientKeys(contactUrn);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('is missing public keys')
      );
    });

    it('should fail gracefully on error', async () => {
      mockMapper.resolveToHandle.mockRejectedValue(
        new Error('Resolution Failed')
      );

      const result = await service.checkRecipientKeys(contactUrn);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // --- 2. Reset Identity Tests ---

  describe('resetIdentityKeys', () => {
    it('should wipe, generate, and upload keys (including Handle)', async () => {
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

      // 3. Upload Handle Keys (Correct URN Properties)
      expect(mockKeyService.storeKeys).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: 'lookup',
          entityType: 'email',
          entityId: 'me@test.com',
        }),
        mockKeyResult.publicKeys
      );
    });
  });
});
