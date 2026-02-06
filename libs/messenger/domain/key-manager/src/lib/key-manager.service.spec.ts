import { TestBed } from '@angular/core/testing';
import { KeyLifecycleService } from './key-manager.service';
import {
  PrivateKeyService,
  WebCryptoKeys,
} from '@nx-platform-application/messenger-infrastructure-private-keys';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

describe('KeyLifecycleService (Domain: Me)', () => {
  let service: KeyLifecycleService;
  let crypto: PrivateKeyService;
  let cache: KeyCacheService;

  const authUrn = URN.parse('urn:auth:google:user1');
  const aliasUrn = URN.parse('urn:lookup:email:user1@test.com');

  const mockPrivateKeys = { encKey: {}, sigKey: {} } as WebCryptoKeys;
  const mockPublicKeys = {
    encKey: new Uint8Array([1]),
    sigKey: new Uint8Array([2]),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        KeyLifecycleService,
        MockProvider(PrivateKeyService, {
          generateAndStoreKeys: vi.fn().mockResolvedValue({
            privateKeys: mockPrivateKeys,
            publicKeys: mockPublicKeys,
          }),
          loadMyKeys: vi.fn().mockResolvedValue(mockPrivateKeys),
          loadMyPublicKeys: vi.fn().mockResolvedValue(mockPublicKeys),
          storeMyKeys: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(KeyCacheService, {
          storeKeys: vi.fn().mockResolvedValue(undefined),
          hasKeys: vi.fn().mockResolvedValue(true),
          clear: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(KeyLifecycleService);
    crypto = TestBed.inject(PrivateKeyService);
    cache = TestBed.inject(KeyCacheService);
  });

  describe('createIdentity', () => {
    it('should generate keys and publish to cache for Auth URN', async () => {
      const keys = await service.createIdentity(authUrn);

      expect(crypto.generateAndStoreKeys).toHaveBeenCalledWith(authUrn);
      expect(cache.storeKeys).toHaveBeenCalledWith(authUrn, mockPublicKeys);
      expect(keys).toBe(mockPrivateKeys);
    });

    it('should publish to Network Alias if provided', async () => {
      await service.createIdentity(authUrn, aliasUrn);

      expect(cache.storeKeys).toHaveBeenCalledWith(authUrn, mockPublicKeys);
      expect(cache.storeKeys).toHaveBeenCalledWith(aliasUrn, mockPublicKeys);
    });
  });

  describe('restoreIdentity', () => {
    it('should return private keys if found', async () => {
      const keys = await service.restoreIdentity(authUrn);
      expect(keys).toBe(mockPrivateKeys);
    });

    it('should repair cache if public keys are missing (Self-Healing)', async () => {
      // Setup: Private keys exist, Cache is empty
      vi.spyOn(cache, 'hasKeys').mockResolvedValue(false);

      await service.restoreIdentity(authUrn);

      // Verify repair
      expect(crypto.loadMyPublicKeys).toHaveBeenCalledWith(authUrn);
      expect(cache.storeKeys).toHaveBeenCalledWith(authUrn, mockPublicKeys);
    });

    it('should return null if private keys are missing', async () => {
      vi.spyOn(crypto, 'loadMyKeys').mockResolvedValue(null);
      const keys = await service.restoreIdentity(authUrn);
      expect(keys).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should delegate to infrastructure', async () => {
      await service.clearCache();
      expect(cache.clear).toHaveBeenCalled();
    });
  });
});
