import { TestBed } from '@angular/core/testing';
import { PrivateKeyService } from './private-key.service';
import { CryptoEngine } from './crypto';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { WebKeyDbStore } from '@nx-platform-application/platform-infrastructure-web-key-storage';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';

describe('PrivateKeyService', () => {
  let service: PrivateKeyService;
  let engine: CryptoEngine;

  const mockLogger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const mockStorage = {
    saveJwk: vi.fn(),
    loadJwk: vi.fn(),
    clearDatabase: vi.fn(),
  };

  beforeAll(() => {
    vi.stubGlobal('crypto', webcrypto);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        PrivateKeyService,
        CryptoEngine,
        { provide: Logger, useValue: mockLogger },
        { provide: WebKeyDbStore, useValue: mockStorage },
      ],
    });
    service = TestBed.inject(PrivateKeyService);
    engine = TestBed.inject(CryptoEngine);
  });

  describe('Key Generation', () => {
    it('generateAndStoreKeys should generate pair, save to DB, and return keys', async () => {
      const urn = URN.parse('urn:contacts:user:test');

      const result = await service.generateAndStoreKeys(urn);

      // 1. Check Return Values
      expect(result.privateKeys.encKey).toBeDefined();
      expect(result.privateKeys.sigKey).toBeDefined();
      expect(result.publicKeys.encKey).toBeInstanceOf(Uint8Array);
      expect(result.publicKeys.sigKey).toBeInstanceOf(Uint8Array);

      // 2. Check Storage Calls (2 saves: Enc + Sig)
      expect(mockStorage.saveJwk).toHaveBeenCalledTimes(2);
      expect(mockStorage.saveJwk).toHaveBeenCalledWith(
        expect.stringContaining(':encryption'),
        expect.objectContaining({ kty: 'RSA' }),
      );
      expect(mockStorage.saveJwk).toHaveBeenCalledWith(
        expect.stringContaining(':signing'),
        expect.objectContaining({ kty: 'RSA' }),
      );
    });
  });

  describe('Key Storage', () => {
    it('storeMyKeys should import keys and save to IndexedDB', async () => {
      const keys = await engine.generateEncryptionKeys();
      const privKeys = {
        encKey: keys.privateKey,
        sigKey: keys.privateKey, // reusing for test simplicity
      };
      const urn = URN.parse('urn:contacts:user:me');

      await service.storeMyKeys(urn, privKeys);

      expect(mockStorage.saveJwk).toHaveBeenCalledTimes(2);
      expect(mockStorage.saveJwk).toHaveBeenCalledWith(
        expect.stringContaining(':encryption'),
        expect.anything(),
      );
    });
  });
});
