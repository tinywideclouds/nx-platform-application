import { TestBed } from '@angular/core/testing';
import { ReceiverHostedFlowService } from './receiver-hosted-flow.service';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/chat-access';
import { Logger } from '@nx-platform-application/console-logger';
import { URN, Priority } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Global Crypto Stub for "exportKey" calls in serializeKeys
vi.stubGlobal('crypto', {
  subtle: { exportKey: vi.fn().mockResolvedValue({ x: 'jwk' }) },
  randomUUID: () => 'uuid',
});

describe('ReceiverHostedFlowService', () => {
  let service: ReceiverHostedFlowService;

  const mockCrypto = {
    generateReceiverSession: vi.fn(),
    parseQrCode: vi.fn(),
    encryptSyncMessage: vi.fn(),
  };
  const mockSend = { sendMessage: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ReceiverHostedFlowService,
        { provide: MessengerCryptoService, useValue: mockCrypto },
        { provide: ChatSendService, useValue: mockSend },
        { provide: Logger, useValue: { info: vi.fn() } },
      ],
    });
    service = TestBed.inject(ReceiverHostedFlowService);
  });

  describe('Target (New Device)', () => {
    it('startSession should return RSA keys and mode', async () => {
      mockCrypto.generateReceiverSession.mockResolvedValue({
        sessionId: 's1',
        publicKey: 'pub',
        privateKey: 'priv',
        qrPayload: 'qr',
      });

      const session = await service.startSession();

      expect(session.mode).toBe('RECEIVER_HOSTED');
      expect(session.privateKey).toBe('priv');
    });
  });

  describe('Source (Old Device)', () => {
    const myKeys = { encKey: {}, sigKey: {} } as any;
    const myUrn = URN.parse('urn:contacts:user:me');

    it('processScannedQr should throw if Mode Mismatch', async () => {
      mockCrypto.parseQrCode.mockResolvedValue({ mode: 'SENDER_HOSTED' }); // Wrong Mode

      await expect(
        service.processScannedQr('qr', myKeys, myUrn)
      ).rejects.toThrow('Invalid QR Mode');
    });

    it('processScannedQr should Encrypt and Send with High Priority', async () => {
      mockCrypto.parseQrCode.mockResolvedValue({
        mode: 'RECEIVER_HOSTED',
        key: 'target-pub-key',
      });

      const mockEnvelope = { isEphemeral: false }; // Service should toggle this
      mockCrypto.encryptSyncMessage.mockResolvedValue(mockEnvelope);
      mockSend.sendMessage.mockReturnValue(of(void 0));

      await service.processScannedQr('qr', myKeys, myUrn);

      // 1. Check Encryption used Target Key
      expect(mockCrypto.encryptSyncMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: URN.parse('urn:contacts:user:me'),
          typeId: URN.parse('urn:message:type:device-sync'),
        }),
        'target-pub-key',
        myKeys
      );

      // 2. Check Flags (Security)
      expect(mockEnvelope.isEphemeral).toBe(true);
      expect((mockEnvelope as any).priority).toBe(Priority.High);

      // 3. Check Network
      expect(mockSend.sendMessage).toHaveBeenCalledWith(mockEnvelope);
    });
  });
});
