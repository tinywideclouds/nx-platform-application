import { TestBed } from '@angular/core/testing';
import { DeviceLinkService } from './device-link.service';
import { Logger } from '@nx-platform-application/console-logger';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/chat-access';
import { ChatIngestionService } from './chat-ingestion.service';
import { ChatService } from '../chat.service';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { webcrypto } from 'node:crypto';

vi.stubGlobal('crypto', webcrypto);
vi.stubGlobal('window', {
  btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
  atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
});

describe('DeviceLinkService', () => {
  let service: DeviceLinkService;

  // --- Mocks ---
  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  // We need a semi-functional crypto mock because the service does heavy keygen
  const mockCryptoEngine = {
    generateEncryptionKeys: async () => {
      const keyPair = await webcrypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );
      return keyPair;
    },
  };

  const mockCryptoService = {
    cryptoEngine: mockCryptoEngine, // Hack to expose engine
    loadMyKeys: vi.fn(),
    encryptSyncMessage: vi.fn().mockResolvedValue({ isEphemeral: true }),
    storeMyKeys: vi.fn(),
  };

  const mockChatService = {
    onboardingState: vi.fn(),
    currentUserUrn: vi.fn(),
    finalizeLinking: vi.fn(),
  };

  const mockIngestion = { process: vi.fn() };
  const mockData = { getMessageBatch: vi.fn(), acknowledge: vi.fn() };
  const mockSend = { sendMessage: vi.fn().mockReturnValue(of(void 0)) };

  beforeEach(() => {
    vi.clearAllMocks();

    // Needed for private property access in service
    (mockCryptoService as any)['cryptoEngine'] = mockCryptoEngine;

    TestBed.configureTestingModule({
      providers: [
        DeviceLinkService,
        { provide: Logger, useValue: mockLogger },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatService, useValue: mockChatService },
        { provide: ChatIngestionService, useValue: mockIngestion },
        { provide: ChatDataService, useValue: mockData },
        { provide: ChatSendService, useValue: mockSend },
      ],
    });
    service = TestBed.inject(DeviceLinkService);
  });

  describe('startLinkSession (Target)', () => {
    it('should generate ephemeral keys and QR payload', async () => {
      const session = await service.startLinkSession();

      expect(session.sessionId).toBeDefined();
      expect(session.publicKey).toBeDefined();
      expect(session.privateKey).toBeDefined();
      expect(session.qrPayload).toContain(session.sessionId);
      expect(JSON.parse(session.qrPayload).key).toBeDefined();
    });
  });

  describe('checkForSyncMessage (Target)', () => {
    it('should throw if not in REQUIRES_LINKING state', async () => {
      mockChatService.onboardingState.mockReturnValue('READY');
      await expect(service.checkForSyncMessage({} as any)).rejects.toThrow();
    });

    it('should finalize linking if sync payload found', async () => {
      mockChatService.onboardingState.mockReturnValue('REQUIRES_LINKING');
      mockChatService.currentUserUrn.mockReturnValue(URN.parse('urn:user:me'));

      // Simulate Ingestion returning a payload
      // We need valid JWKs in the payload because parseSyncPayload parses them
      const keyPair = await mockCryptoEngine.generateEncryptionKeys();
      const encJwk = await webcrypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey
      );
      // Reuse for sig just for test structure
      const payloadJson = JSON.stringify({ enc: encJwk, sig: encJwk });

      mockIngestion.process.mockResolvedValue({
        messages: [],
        typingIndicators: [],
        syncPayload: {
          payloadBytes: new TextEncoder().encode(payloadJson),
        },
      });

      await service.checkForSyncMessage({} as any);

      expect(mockIngestion.process).toHaveBeenCalledWith(
        null,
        expect.anything(),
        expect.anything(),
        50,
        true, // Safe Mode
        expect.anything() // Session Key
      );

      expect(mockChatService.finalizeLinking).toHaveBeenCalled();
    });
  });

  describe('linkTargetDevice (Source)', () => {
    it('should drain queue then encrypt and send keys', async () => {
      mockChatService.currentUserUrn.mockReturnValue(
        URN.parse('urn:contacts:user:me')
      );

      // Mock My Keys
      const myKeys = {
        encKey: (await mockCryptoEngine.generateEncryptionKeys()).privateKey,
      };
      mockCryptoService.loadMyKeys.mockResolvedValue(myKeys);

      // Prepare valid QR string
      const targetKeys = await mockCryptoEngine.generateEncryptionKeys();
      const spki = await webcrypto.subtle.exportKey(
        'spki',
        targetKeys.publicKey
      );
      const b64 = Buffer.from(spki as ArrayBuffer).toString('base64');
      const qr = JSON.stringify({ sid: '123', key: b64 });

      await service.linkTargetDevice(qr);

      // 2. Encrypt
      expect(mockCryptoService.encryptSyncMessage).toHaveBeenCalled();

      // 3. Send
      expect(mockSend.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ isEphemeral: true })
      );
    });
  });
});
