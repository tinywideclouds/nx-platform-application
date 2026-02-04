import { TestBed } from '@angular/core/testing';
import { PairingSecurityService } from './pairing-security.service';
import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-private-keys';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';

describe('PairingSecurityService', () => {
  let service: PairingSecurityService;

  const mockLogger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() };
  // Mocking SecureKeyService just to satisfy DI, though unused in logic
  const mockKeyService = { storeKeys: vi.fn(), getKey: vi.fn() };

  beforeAll(() => {
    vi.stubGlobal('crypto', webcrypto);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        PairingSecurityService,
        CryptoEngine,
        { provide: Logger, useValue: mockLogger },
        // Providing a dummy mock for the unused injection
        { provide: 'SecureKeyService', useValue: mockKeyService },
      ],
    });
    service = TestBed.inject(PairingSecurityService);
  });

  describe('QR Handshake Flow', () => {
    it('should generate valid RSA session (Mode A), serialize to QR, and re-import', async () => {
      // 1. GENERATION (Receiver Hosted)
      const session = await service.generateReceiverSession();

      expect(session.sessionId).toBeDefined();
      expect(session.privateKey).toBeDefined();
      expect(session.publicKey).toBeDefined();
      expect(session.qrPayload).toContain('"m":"rh"'); // Check Mode Flag

      // 2. SCAN (Parse)
      const parsed = await service.parseQrCode(session.qrPayload);

      expect(parsed.mode).toBe('RECEIVER_HOSTED');
      expect(parsed.sessionId).toBe(session.sessionId);
      expect(parsed.key.algorithm.name).toBe('RSA-OAEP');

      // 3. VERIFY (Round Trip Encryption)
      // Encrypt with Parsed Public Key -> Decrypt with Original Private Key
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
      // 1. GENERATION (Sender Hosted)
      const session = await service.generateSenderSession();

      expect(session.sessionId).toBeDefined();
      expect(session.oneTimeKey).toBeDefined();
      expect(session.qrPayload).toContain('"m":"sh"'); // Check Mode Flag

      // 2. SCAN (Parse)
      const parsed = await service.parseQrCode(session.qrPayload);

      expect(parsed.mode).toBe('SENDER_HOSTED');
      expect(parsed.sessionId).toBe(session.sessionId);
      expect(parsed.key.algorithm.name).toBe('AES-GCM');

      // 3. VERIFY (Round Trip Encryption)
      // Encrypt with Original Session Key -> Decrypt with Parsed Key
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

      const badQr = JSON.stringify({ sid: '1', key: 'abcd', m: 'xyz', v: 1 });
      await expect(service.parseQrCode(badQr)).rejects.toThrow(
        'Unknown QR Mode',
      );
    });
  });
});
