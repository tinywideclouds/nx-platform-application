// libs/messenger/crypto-bridge/src/lib/messenger-crypto.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { MessengerCryptoService } from './messenger-crypto.service';
import { CryptoEngine } from './crypto';
import { Logger } from '@nx-platform-application/console-logger';
import { SecureKeyService } from '@nx-platform-application/messenger-key-access';
import { WebKeyDbStore } from '@nx-platform-application/platform-web-key-storage';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';

vi.stubGlobal('crypto', webcrypto);

// --- Mocks ---
const mockLogger = { debug: vi.fn(), error: vi.fn() };
const mockKeyService = { storeKeys: vi.fn(), getKey: vi.fn() };
const mockStorage = {
  saveJwk: vi.fn(),
  loadJwk: vi.fn(),
  clearDatabase: vi.fn(),
};

describe('MessengerCryptoService', () => {
  let service: MessengerCryptoService;
  let engine: CryptoEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        MessengerCryptoService,
        CryptoEngine,
        { provide: Logger, useValue: mockLogger },
        { provide: SecureKeyService, useValue: mockKeyService },
        { provide: WebKeyDbStore, useValue: mockStorage },
      ],
    });
    service = TestBed.inject(MessengerCryptoService);
    engine = TestBed.inject(CryptoEngine);
  });

  describe('Sync Message Crypto (Trojan Horse)', () => {
    it('should encrypt with Session Key and Sign with Identity Key, then Decrypt correctly', async () => {
      // 1. Setup Identities
      // Device A (Source): Has Identity Keys
      const deviceAKeys = await service.generateAndStoreKeys(
        URN.parse('urn:contacts:user:A')
      );

      // Device B (Target): Has Session Keys
      const sessionKeys = await engine.generateEncryptionKeys(); // RSA-OAEP

      // Payload
      const payload = {
        senderId: URN.parse('urn:contacts:user:A'),
        sentTimestamp: '2025-01-01T12:00:00Z' as any,
        typeId: URN.parse('urn:message:type:device-sync'),
        payloadBytes: new TextEncoder().encode('SECRET_MASTER_KEY'),
      };

      // 2. Device A: Encrypts for Device B's Session Key
      // Mock getKey to return A's public keys (for signature verification later)
      mockKeyService.getKey.mockResolvedValue(deviceAKeys.publicKeys);

      const envelope = await service.encryptSyncMessage(
        payload,
        sessionKeys.publicKey,
        deviceAKeys.privateKeys
      );

      expect(envelope.encryptedData).toBeDefined();
      expect(envelope.signature).toBeDefined();

      // 3. Device B: Decrypts using Session Private Key
      // It will internally fetch 'urn:user:A' keys to verify signature
      const decrypted = await service.decryptSyncMessage(
        envelope,
        sessionKeys.privateKey
      );

      // 4. Verify
      expect(decrypted.typeId.toString()).toBe('urn:message:type:device-sync');
      expect(new TextDecoder().decode(decrypted.payloadBytes)).toBe(
        'SECRET_MASTER_KEY'
      );
    });
  });

  describe('Key Storage', () => {
    it('storeMyKeys should save keys to IndexedDB', async () => {
      const keys = await engine.generateEncryptionKeys();
      // Mock keys object structure roughly
      const privKeys = {
        encKey: keys.privateKey,
        sigKey: keys.privateKey,
      } as any;
      const urn = URN.parse('urn:contacts:user:me');

      await service.storeMyKeys(urn, privKeys);

      // Expect 2 saves (Encryption + Signing)
      expect(mockStorage.saveJwk).toHaveBeenCalledTimes(2);
      expect(mockStorage.saveJwk).toHaveBeenCalledWith(
        expect.stringContaining(':encryption'),
        expect.anything()
      );
    });
  });
});
