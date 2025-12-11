import { TestBed } from '@angular/core/testing';
import { MessengerCryptoService } from './messenger-crypto.service';
import { CryptoEngine } from './crypto';
import { SecureKeyService } from '@nx-platform-application/messenger-key-access';
import { WebKeyDbStore } from '@nx-platform-application/platform-web-key-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi } from 'vitest';
import { webcrypto } from 'node:crypto'; // ✅ Import Node's Web Crypto

describe('MessengerCryptoService: QR Handshake Flow', () => {
  let service: MessengerCryptoService;

  // ✅ FIX 1: Polyfill Web Crypto for the Test Environment
  beforeAll(() => {
    vi.stubGlobal('crypto', webcrypto);
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MessengerCryptoService,
        CryptoEngine,
        MockProvider(WebKeyDbStore),
        MockProvider(SecureKeyService),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(MessengerCryptoService);
  });

  describe('Mode A: Receiver-Hosted (Target displays, Source scans)', () => {
    it('should generate valid RSA session, serialize to QR, and re-import successfully', async () => {
      // 1. GENERATION
      const session = await service.generateReceiverSession();

      expect(session.sessionId).toBeDefined();
      expect(session.privateKey).toBeDefined();
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
        testData
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        session.privateKey,
        encrypted
      );

      const result = new TextDecoder().decode(decrypted);
      expect(result).toBe('Hello World');
    });
  });

  describe('Mode B: Sender-Hosted (Source displays, Target scans)', () => {
    it('should generate valid AES session, serialize to QR, and re-import successfully', async () => {
      // 1. GENERATION
      const session = await service.generateSenderSession();

      expect(session.sessionId).toBeDefined();
      expect(session.oneTimeKey).toBeDefined();
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
        testData
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        parsed.key,
        encrypted
      );

      const result = new TextDecoder().decode(decrypted);
      expect(result).toBe('Secret Keys inside');
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid JSON', async () => {
      await expect(service.parseQrCode('Not a JSON string')).rejects.toThrow(
        'Invalid QR Format'
      );
    });

    it('should throw on unknown mode', async () => {
      // ✅ FIX 2: Use valid Base64 ('abcd') so atob() doesn't crash before the mode check
      const badQr = JSON.stringify({ s: '1', k: 'abcd', m: 'xyz', v: 1 });
      await expect(service.parseQrCode(badQr)).rejects.toThrow(
        'Unknown QR Mode'
      );
    });
  });
});
