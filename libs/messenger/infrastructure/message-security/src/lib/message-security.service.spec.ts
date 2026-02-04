import { TestBed } from '@angular/core/testing';
import { MessageSecurityService } from './message-security.service';
import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-private-keys';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { SecureKeyService } from '@nx-platform-application/messenger-infrastructure-key-access';
import { WebKeyDbStore } from '@nx-platform-application/platform-infrastructure-web-key-storage';
import {
  URN,
  ISODateTimeString,
  PublicKeys,
} from '@nx-platform-application/platform-types';
import { TransportMessage } from '@nx-platform-application/messenger-types';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';

describe('MessageSecurityService', () => {
  let service: MessageSecurityService;
  let engine: CryptoEngine;

  const mockLogger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const mockKeyService = { getKey: vi.fn() };
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
        MessageSecurityService,
        CryptoEngine,
        { provide: Logger, useValue: mockLogger },
        { provide: SecureKeyService, useValue: mockKeyService },
        { provide: WebKeyDbStore, useValue: mockStorage },
      ],
    });
    service = TestBed.inject(MessageSecurityService);
    engine = TestBed.inject(CryptoEngine);
  });

  // Helper to generate keys and return them in the expected formats
  async function generateIdentity(urn: string) {
    const encKeyPair = await engine.generateEncryptionKeys();
    const sigKeyPair = await engine.generateSigningKeys();

    const encPubBytes = await crypto.subtle.exportKey(
      'spki',
      encKeyPair.publicKey,
    );
    const sigPubBytes = await crypto.subtle.exportKey(
      'spki',
      sigKeyPair.publicKey,
    );

    const privateKeys = {
      encKey: encKeyPair.privateKey,
      sigKey: sigKeyPair.privateKey,
    };

    const publicKeys: PublicKeys = {
      encKey: new Uint8Array(encPubBytes),
      sigKey: new Uint8Array(sigPubBytes),
    };

    return { urn: URN.parse(urn), privateKeys, publicKeys };
  }

  describe('Sealed Sender Protocol (P2P)', () => {
    it('should Encrypt (A->B) and Decrypt (B) successfully', async () => {
      // 1. Setup Identities
      const alice = await generateIdentity('urn:messenger:user:alice');
      const bob = await generateIdentity('urn:messenger:user:bob');

      // 2. Prepare Payload
      const payload: TransportMessage = {
        senderId: alice.urn,
        sentTimestamp: '2025-01-01T00:00:00Z' as ISODateTimeString,
        typeId: URN.parse('urn:message:type:text'),
        payloadBytes: new TextEncoder().encode('Hello Bob'),
      };

      // 3. Alice Encrypts for Bob
      const envelope = await service.encryptAndSign(
        payload,
        bob.urn,
        alice.privateKeys,
        bob.publicKeys,
      );

      expect(envelope.encryptedData).toBeDefined();
      expect(envelope.signature).toBeDefined();

      // 4. Bob Decrypts
      // MOCK: Bob needs to look up Alice's Public Key to verify the signature
      mockKeyService.getKey.mockResolvedValue(alice.publicKeys);

      const decrypted = await service.verifyAndDecrypt(
        envelope,
        bob.privateKeys,
      );

      // 5. Verify Content
      expect(decrypted.senderId.toString()).toBe(alice.urn.toString());
      expect(new TextDecoder().decode(decrypted.payloadBytes)).toBe(
        'Hello Bob',
      );
    });

    it('should fail decryption if signature is forged', async () => {
      const alice = await generateIdentity('urn:messenger:user:alice');
      const bob = await generateIdentity('urn:messenger:user:bob');
      const eve = await generateIdentity('urn:messenger:user:eve');

      const payload: TransportMessage = {
        senderId: alice.urn, // Eve claims to be Alice
        sentTimestamp: '2025-01-01T00:00:00Z' as ISODateTimeString,
        typeId: URN.parse('urn:message:type:text'),
        payloadBytes: new TextEncoder().encode('Fake Msg'),
      };

      // Eve encrypts for Bob, but signs with EVE'S key
      const envelope = await service.encryptAndSign(
        payload,
        bob.urn,
        eve.privateKeys, // <-- Wrong private key
        bob.publicKeys,
      );

      // Bob thinks message is from Alice
      mockKeyService.getKey.mockResolvedValue(alice.publicKeys);

      // Decryption should succeed (AES), but Verification (RSA-PSS) should fail
      await expect(
        service.verifyAndDecrypt(envelope, bob.privateKeys),
      ).rejects.toThrow('Message Forged');
    });
  });

  describe('Device Pairing Crypto', () => {
    it('should encrypt Sync Message (RSA Session Key)', async () => {
      // Device A (Has Identity)
      const deviceA = await generateIdentity('urn:messenger:user:A');
      // Device B (Has Ephemeral Session Key)
      const sessionKeys = await engine.generateEncryptionKeys();

      const payload: TransportMessage = {
        senderId: deviceA.urn,
        sentTimestamp: '2025-01-01T00:00:00Z' as ISODateTimeString,
        typeId: URN.parse('urn:message:type:sync'),
        payloadBytes: new TextEncoder().encode('SYNC_DATA'),
      };

      // 1. Device A Encrypts
      const envelope = await service.encryptSyncMessage(
        payload,
        sessionKeys.publicKey,
        deviceA.privateKeys,
      );

      // 2. Device B Decrypts
      // Device B needs Device A's keys to verify signature
      mockKeyService.getKey.mockResolvedValue(deviceA.publicKeys);

      const decrypted = await service.decryptSyncMessage(
        envelope,
        sessionKeys.privateKey,
      );

      expect(new TextDecoder().decode(decrypted.payloadBytes)).toBe(
        'SYNC_DATA',
      );
    });

    it('should encrypt Sync Offer (AES One-Time Key)', async () => {
      // Symmetric Key from QR Code
      const oneTimeKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );

      const payload: TransportMessage = {
        senderId: URN.parse('urn:messenger:user:A'),
        sentTimestamp: '2025-01-01T00:00:00Z' as ISODateTimeString,
        typeId: URN.parse('urn:message:type:offer'),
        payloadBytes: new TextEncoder().encode('OFFER_DATA'),
      };

      // 1. Encrypt
      const envelope = await service.encryptSyncOffer(payload, oneTimeKey);

      // 2. Decrypt
      const decrypted = await service.decryptSyncOffer(envelope, oneTimeKey);

      expect(new TextDecoder().decode(decrypted.payloadBytes)).toBe(
        'OFFER_DATA',
      );
    });
  });
});
