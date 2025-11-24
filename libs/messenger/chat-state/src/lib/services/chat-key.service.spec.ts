// libs/messenger/chat-state/src/lib/services/chat-key.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { ChatKeyService } from './chat-key.service';
import { URN } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

// Services
import { ContactsStorageService } from '@nx-platform-application/contacts-access';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-access';
import { Logger } from '@nx-platform-application/console-logger';

describe('ChatKeyService', () => {
  let service: ChatKeyService;

  // --- Mocks ---
  const mockContactsService = {
    getLinkedIdentities: vi.fn(),
    getContact: vi.fn(),
  };
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

  // --- Fixtures ---
  const contactUrn = URN.parse('urn:sm:user:alice');
  const authUrn = URN.parse('urn:auth:google:alice-123');
  const lookupUrn = URN.parse('urn:lookup:email:alice@test.com');

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatKeyService,
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: KeyCacheService, useValue: mockKeyService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(ChatKeyService);
  });

  // --- 1. Identity Resolution Tests ---

  describe('resolveRecipientIdentity', () => {
    it('should return Auth/Lookup URNs as-is (Pass-through)', async () => {
      expect(await service.resolveRecipientIdentity(authUrn)).toBe(authUrn);
      expect(await service.resolveRecipientIdentity(lookupUrn)).toBe(lookupUrn);
    });

    it('should return Linked Identity if handshake exists', async () => {
      mockContactsService.getLinkedIdentities.mockResolvedValue([authUrn]);

      const result = await service.resolveRecipientIdentity(contactUrn);

      expect(mockContactsService.getLinkedIdentities).toHaveBeenCalledWith(contactUrn);
      expect(result).toBe(authUrn);
    });

    it('should FALLBACK to Email Lookup if no link exists but email is known', async () => {
      // 1. No Link
      mockContactsService.getLinkedIdentities.mockResolvedValue([]);
      // 2. Contact has email
      mockContactsService.getContact.mockResolvedValue({
        id: contactUrn,
        emailAddresses: ['alice@test.com'],
      });

      const result = await service.resolveRecipientIdentity(contactUrn);

      // Expect fallback to Lookup URN
      expect(result.toString()).toBe('urn:lookup:email:alice@test.com');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Resolved Contact')
      );
    });

    it('should fallback to original URN if no link and no email', async () => {
      mockContactsService.getLinkedIdentities.mockResolvedValue([]);
      mockContactsService.getContact.mockResolvedValue({
        id: contactUrn,
        emailAddresses: [], // No email
      });

      const result = await service.resolveRecipientIdentity(contactUrn);
      expect(result).toBe(contactUrn);
    });
  });

  // --- 2. Key Check Tests ---

  describe('checkRecipientKeys', () => {
    it('should resolve identity and check KeyService', async () => {
      // Mock resolution logic manually or trust the internal call
      // Here we simulate resolution returning a lookup URN
      mockContactsService.getLinkedIdentities.mockResolvedValue([authUrn]);
      mockKeyService.hasKeys.mockResolvedValue(true);

      const result = await service.checkRecipientKeys(contactUrn);

      expect(mockKeyService.hasKeys).toHaveBeenCalledWith(authUrn);
      expect(result).toBe(true);
    });

    it('should log warning if keys are missing', async () => {
      mockContactsService.getLinkedIdentities.mockResolvedValue([authUrn]);
      mockKeyService.hasKeys.mockResolvedValue(false);

      const result = await service.checkRecipientKeys(contactUrn);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('is missing public keys')
      );
    });

    it('should fail gracefully on error', async () => {
      mockContactsService.getLinkedIdentities.mockRejectedValue(new Error('DB Error'));
      
      const result = await service.checkRecipientKeys(contactUrn);
      
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // --- 3. Reset Identity Tests ---

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
      expect(mockCryptoService.generateAndStoreKeys).toHaveBeenCalledWith(myUrn);
      
      // 3. Upload Handle Keys (The critical fix)
      expect(mockKeyService.storeKeys).toHaveBeenCalledWith(
        expect.objectContaining({ 
          nid: 'lookup', 
          nss: 'email:me@test.com' 
        }),
        mockKeyResult.publicKeys
      );
    });
  });
});