import { TestBed } from '@angular/core/testing';
import { SenderHostedFlowService } from './sender-hosted-flow.service';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { HotQueueMonitor } from '../workers/hot-queue-monitor.service';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.stubGlobal('crypto', {
  subtle: {
    exportKey: vi.fn().mockResolvedValue({ x: 'jwk' }),
    importKey: vi.fn().mockResolvedValue('imported-key'),
    generateKey: vi.fn().mockResolvedValue('aes-key'),
  },
});
vi.stubGlobal(
  'TextDecoder',
  class {
    decode() {
      return '{"enc":{},"sig":{}}';
    }
  },
);
vi.stubGlobal(
  'TextEncoder',
  class {
    encode() {
      return new Uint8Array([]);
    }
  },
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
  const mockIdentityResolver = {
    resolveToHandle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        SenderHostedFlowService,
        { provide: MessengerCryptoService, useValue: mockCrypto },
        { provide: ChatSendService, useValue: mockSend },
        { provide: HotQueueMonitor, useValue: mockSpy },
        { provide: IdentityResolver, useValue: mockIdentityResolver },
        {
          provide: Logger,
          useValue: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
        },
      ],
    });
    service = TestBed.inject(SenderHostedFlowService);
  });

  describe('Source (Old Device)', () => {
    it('startSession should resolve identity and send to HANDLE', async () => {
      const myAuthUrn = URN.parse('urn:auth:google:123');
      const myHandleUrn = URN.parse('urn:lookup:email:me@test.com');
      const myKeys = {} as any;

      mockCrypto.generateSenderSession.mockResolvedValue({
        oneTimeKey: 'aes-key',
        qrPayload: 'qr',
      });
      mockIdentityResolver.resolveToHandle.mockResolvedValue(myHandleUrn);

      const mockEnvelope = { recipientId: null, isEphemeral: false };
      mockCrypto.encryptSyncOffer.mockResolvedValue(mockEnvelope);
      mockSend.sendMessage.mockReturnValue(of(void 0));

      await service.startSession(myKeys, myAuthUrn);

      expect(mockIdentityResolver.resolveToHandle).toHaveBeenCalledWith(
        myAuthUrn,
      );
      expect(mockEnvelope.recipientId).toBe(myHandleUrn);
      expect(mockEnvelope.isEphemeral).toBe(true);
      expect(mockSend.sendMessage).toHaveBeenCalled();
    });

    it('startSession should fallback to Auth ID if resolution fails', async () => {
      const myAuthUrn = URN.parse('urn:auth:google:123');
      const myKeys = {} as any;

      mockCrypto.generateSenderSession.mockResolvedValue({ oneTimeKey: 'k' });
      mockIdentityResolver.resolveToHandle.mockRejectedValue(
        new Error('Not found'),
      );

      const mockEnvelope = { recipientId: null };
      mockCrypto.encryptSyncOffer.mockResolvedValue(mockEnvelope);
      mockSend.sendMessage.mockReturnValue(of(void 0));

      await service.startSession(myKeys, myAuthUrn);

      expect(mockEnvelope.recipientId).toBe(myAuthUrn);
    });
  });

  describe('Target (New Device)', () => {
    it('redeemScannedQr should throw on Mode Mismatch', async () => {
      mockCrypto.parseQrCode.mockResolvedValue({ mode: 'RECEIVER_HOSTED' });
      await expect(
        service.redeemScannedQr('qr', URN.parse('urn:contacts:user:me')),
      ).rejects.toThrow('Invalid QR Mode');
    });
  });
});
