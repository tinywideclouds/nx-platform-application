import { TestBed } from '@angular/core/testing';
import { SenderHostedFlowService } from './sender-hosted-flow.service';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/chat-access';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter'; // ✅ NEW
import { HotQueueMonitor } from '../workers/hot-queue-monitor.service';
import { Logger } from '@nx-platform-application/console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Global Crypto Stub
vi.stubGlobal('crypto', {
  subtle: {
    exportKey: vi.fn().mockResolvedValue({ x: 'jwk' }),
    importKey: vi.fn().mockResolvedValue('imported-key'),
    generateKey: vi.fn().mockResolvedValue('aes-key'), // Mock AES gen
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
// TextEncoder is usually available in node environment, if not stub it too.
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

  // ✅ NEW: Mock Identity Resolver
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
        { provide: IdentityResolver, useValue: mockIdentityResolver }, // ✅ Provide Mock
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

      // 1. Setup Mocks
      mockCrypto.generateSenderSession.mockResolvedValue({
        oneTimeKey: 'aes-key',
        qrPayload: 'qr',
      });

      // Resolver returns the Handle
      mockIdentityResolver.resolveToHandle.mockResolvedValue(myHandleUrn);

      const mockEnvelope = { recipientId: null, isEphemeral: false };
      mockCrypto.encryptSyncOffer.mockResolvedValue(mockEnvelope);
      mockSend.sendMessage.mockReturnValue(of(void 0));

      // 2. Act
      await service.startSession(myKeys, myAuthUrn);

      // 3. Assert
      expect(mockIdentityResolver.resolveToHandle).toHaveBeenCalledWith(
        myAuthUrn,
      );

      // ✅ VERIFY FIX: The envelope must be addressed to the HANDLE
      expect(mockEnvelope.recipientId).toBe(myHandleUrn);
      expect(mockEnvelope.recipientId).not.toBe(myAuthUrn);

      expect(mockEnvelope.isEphemeral).toBe(true);
      expect(mockSend.sendMessage).toHaveBeenCalled();
    });

    it('startSession should fallback to Auth ID if resolution fails', async () => {
      const myAuthUrn = URN.parse('urn:auth:google:123');
      const myKeys = {} as any;

      mockCrypto.generateSenderSession.mockResolvedValue({ oneTimeKey: 'k' });
      mockIdentityResolver.resolveToHandle.mockRejectedValue(
        new Error('Not found'),
      ); // Fail

      const mockEnvelope = { recipientId: null };
      mockCrypto.encryptSyncOffer.mockResolvedValue(mockEnvelope);
      mockSend.sendMessage.mockReturnValue(of(void 0));

      await service.startSession(myKeys, myAuthUrn);

      // Verify Fallback
      expect(mockEnvelope.recipientId).toBe(myAuthUrn);
    });
  });

  describe('Target (New Device)', () => {
    // ... existing tests ...
    it('redeemScannedQr should throw on Mode Mismatch', async () => {
      mockCrypto.parseQrCode.mockResolvedValue({ mode: 'RECEIVER_HOSTED' });
      await expect(
        service.redeemScannedQr('qr', URN.parse('urn:contacts:user:me')),
      ).rejects.toThrow('Invalid QR Mode');
    });
  });
});
