import { TestBed } from '@angular/core/testing';
import { SenderHostedFlowService } from './sender-hosted-flow.service';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/chat-access';
import { HotQueueMonitor } from '../workers/hot-queue-monitor.service';
import { Logger } from '@nx-platform-application/console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Global Crypto Stub for serialization/deserialization
vi.stubGlobal('crypto', {
  subtle: {
    exportKey: vi.fn().mockResolvedValue({ x: 'jwk' }),
    importKey: vi.fn().mockResolvedValue('imported-key'),
  },
});
vi.stubGlobal(
  'TextDecoder',
  class {
    decode() {
      return '{"enc":{},"sig":{}}';
    }
  }
);

describe('SenderHostedFlowService', () => {
  let service: SenderHostedFlowService;

  const mockCrypto = {
    generateSenderSession: vi.fn(),
    encryptSyncOffer: vi.fn(),
    parseQrCode: vi.fn(),
  };
  const mockSend = { sendMessage: vi.fn() };
  const mockSpy = { checkQueueForInvite: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        SenderHostedFlowService,
        { provide: MessengerCryptoService, useValue: mockCrypto },
        { provide: ChatSendService, useValue: mockSend },
        { provide: HotQueueMonitor, useValue: mockSpy },
        { provide: Logger, useValue: { info: vi.fn(), debug: vi.fn() } },
      ],
    });
    service = TestBed.inject(SenderHostedFlowService);
  });

  describe('Source (Old Device)', () => {
    it('startSession should Dead Drop to SELF', async () => {
      const myUrn = URN.parse('urn:user:contacts:me');
      const myKeys = {} as any;

      mockCrypto.generateSenderSession.mockResolvedValue({
        oneTimeKey: 'aes-key',
        qrPayload: 'qr',
      });
      const mockEnvelope = { recipientId: null, isEphemeral: false };
      mockCrypto.encryptSyncOffer.mockResolvedValue(mockEnvelope);
      mockSend.sendMessage.mockReturnValue(of(void 0));

      await service.startSession(myKeys, myUrn);

      // Verify Dead Drop Logic
      expect(mockEnvelope.recipientId).toBe(myUrn); // Sent to self
      expect(mockEnvelope.isEphemeral).toBe(true);
      expect(mockSend.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Target (New Device)', () => {
    it('redeemScannedQr should throw on Mode Mismatch', async () => {
      mockCrypto.parseQrCode.mockResolvedValue({ mode: 'RECEIVER_HOSTED' });
      await expect(
        service.redeemScannedQr('qr', URN.parse('urn:contacts:user:me'))
      ).rejects.toThrow('Invalid QR Mode');
    });

    it('redeemScannedQr should deserialize keys if Spy finds payload', async () => {
      mockCrypto.parseQrCode.mockResolvedValue({
        mode: 'SENDER_HOSTED',
        key: 'aes-key',
      });

      // Spy finds the dead drop
      mockSpy.checkQueueForInvite.mockResolvedValue({
        payloadBytes: new Uint8Array([]),
      });

      const keys = await service.redeemScannedQr(
        'qr',
        URN.parse('urn:contacts:user:me')
      );

      expect(mockSpy.checkQueueForInvite).toHaveBeenCalledWith(
        'aes-key',
        expect.anything()
      );
      expect(keys).toEqual({ encKey: 'imported-key', sigKey: 'imported-key' });
    });
  });
});
