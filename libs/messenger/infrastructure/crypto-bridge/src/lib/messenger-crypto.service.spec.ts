import { TestBed } from '@angular/core/testing';
import { MessengerCryptoService } from './messenger-crypto.service';
import { CryptoEngine } from './crypto';
import { Logger } from '@nx-platform-application/console-logger';
import { SecureKeyService } from '@nx-platform-application/messenger-infrastructure-key-access';
import { WebKeyDbStore } from '@nx-platform-application/platform-web-key-storage';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';

describe('MessengerCryptoService', () => {
  let service: MessengerCryptoService;
  let engine: CryptoEngine;

  const mockLogger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const mockKeyService = { storeKeys: vi.fn(), getKey: vi.fn() };
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

  describe('Sync Message Crypto', () => {
    it('should encrypt with Session Key and Sign with Identity Key, then Decrypt correctly', async () => {
      // 1. Setup Identities
      // Device A (Source): Has Identity Keys
      const deviceAKeys = await service.generateAndStoreKeys(
        URN.parse('urn:contacts:user:A'),
      );

      // Device B (Target): Has Session Keys
      const sessionKeys = await engine.generateEncryptionKeys(); // RSA-OAEP

      // Payload
      const payload = {
        senderId: URN.parse('urn:contacts:user:A'),
        sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
        typeId: URN.parse('urn:message:type:device-sync'),
        payloadBytes: new TextEncoder().encode('SECRET_MASTER_KEY'),
      };

      // 2. Device A: Encrypts for Device B's Session Key
      // Mock getKey to return A's public keys (for signature verification later)
      mockKeyService.getKey.mockResolvedValue(deviceAKeys.publicKeys);

      const envelope = await service.encryptSyncMessage(
        payload,
        sessionKeys.publicKey,
        deviceAKeys.privateKeys,
      );

      expect(envelope.encryptedData).toBeDefined();
      expect(envelope.signature).toBeDefined();

      // 3. Device B: Decrypts using Session Private Key
      // It will internally fetch 'urn:user:A' keys to verify signature
      const decrypted = await service.decryptSyncMessage(
        envelope,
        sessionKeys.privateKey,
      );

      // 4. Verify
      expect(decrypted.typeId.toString()).toBe('urn:message:type:device-sync');
      expect(new TextDecoder().decode(decrypted.payloadBytes)).toBe(
        'SECRET_MASTER_KEY',
      );
    });
  });

  describe('Key Storage', () => {
    it('storeMyKeys should save keys to IndexedDB', async () => {
      const keys = await engine.generateEncryptionKeys();
      const privKeys = {
        encKey: keys.privateKey,
        sigKey: keys.privateKey,
      };
      const urn = URN.parse('urn:contacts:user:me');

      await service.storeMyKeys(urn, privKeys);

      // Expect 2 saves (Encryption + Signing)
      expect(mockStorage.saveJwk).toHaveBeenCalledTimes(2);
      expect(mockStorage.saveJwk).toHaveBeenCalledWith(
        expect.stringContaining(':encryption'),
        expect.anything(),
      );
    });
  });

  describe('QR Handshake Flow', () => {
    it('should generate valid RSA session (Mode A), serialize to QR, and re-import', async () => {
      // 1. GENERATION
      const session = await service.generateReceiverSession();
      expect(session.sessionId).toBeDefined();
      expect(session.qrPayload).toContain('"m":"rh"');

      // 2. SCAN
      const parsed = await service.parseQrCode(session.qrPayload);
      expect(parsed.mode).toBe('RECEIVER_HOSTED');
      expect(parsed.sessionId).toBe(session.sessionId);
      expect(parsed.key.algorithm.name).toBe('RSA-OAEP');

      // 3. VERIFY (Round Trip)
      const testData = new TextEncoder().encode('Hello World');
      const encrypted = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        parsed.key,
        testData,
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        session.privateKey,
        encrypted,
      );
      expect(new TextDecoder().decode(decrypted)).toBe('Hello World');
    });

    it('should generate valid AES session (Mode B), serialize to QR, and re-import', async () => {
      // 1. GENERATION
      const session = await service.generateSenderSession();
      expect(session.sessionId).toBeDefined();
      expect(session.qrPayload).toContain('"m":"sh"');

      // 2. SCAN
      const parsed = await service.parseQrCode(session.qrPayload);
      expect(parsed.mode).toBe('SENDER_HOSTED');
      expect(parsed.sessionId).toBe(session.sessionId);
      expect(parsed.key.algorithm.name).toBe('AES-GCM');

      // 3. VERIFY (Round Trip)
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const testData = new TextEncoder().encode('Secret Keys inside');
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        session.oneTimeKey,
        testData,
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        parsed.key,
        encrypted,
      );
      expect(new TextDecoder().decode(decrypted)).toBe('Secret Keys inside');
    });

    it('should throw on invalid QR', async () => {
      await expect(service.parseQrCode('Not a JSON string')).rejects.toThrow(
        'Invalid QR Format',
      );

      const badQr = JSON.stringify({ s: '1', k: 'abcd', m: 'xyz', v: 1 });
      await expect(service.parseQrCode(badQr)).rejects.toThrow(
        'Unknown QR Mode',
      );
    });
  });
});
