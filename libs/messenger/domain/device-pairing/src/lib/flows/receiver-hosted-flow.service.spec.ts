import { TestBed } from '@angular/core/testing';
import { ReceiverHostedFlowService } from './receiver-hosted-flow.service';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN, Priority } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.stubGlobal('crypto', {
  subtle: { exportKey: vi.fn().mockResolvedValue({ x: 'jwk' }) },
  randomUUID: () => 'uuid',
});
vi.stubGlobal(
  'TextEncoder',
  class {
    encode() {
      return new Uint8Array([]);
    }
  },
);

describe('ReceiverHostedFlowService', () => {
  let service: ReceiverHostedFlowService;

  const mockCrypto = {
    generateReceiverSession: vi.fn(),
    parseQrCode: vi.fn(),
    encryptSyncMessage: vi.fn(),
  };
  const mockSend = { sendMessage: vi.fn() };
  const mockIdentityResolver = {
    resolveToHandle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ReceiverHostedFlowService,
        { provide: MessengerCryptoService, useValue: mockCrypto },
        { provide: ChatSendService, useValue: mockSend },
        { provide: IdentityResolver, useValue: mockIdentityResolver },
        { provide: Logger, useValue: { info: vi.fn(), warn: vi.fn() } },
      ],
    });
    service = TestBed.inject(ReceiverHostedFlowService);
  });

  describe('Source (Old Device)', () => {
    const myKeys = { encKey: {}, sigKey: {} } as any;
    const myAuthUrn = URN.parse('urn:auth:google:123');
    const myHandleUrn = URN.parse('urn:lookup:email:me@test.com');

    it('processScannedQr should resolve identity and send to HANDLE', async () => {
      mockCrypto.parseQrCode.mockResolvedValue({
        mode: 'RECEIVER_HOSTED',
        key: 'target-pub-key',
      });

      mockIdentityResolver.resolveToHandle.mockResolvedValue(myHandleUrn);

      const mockEnvelope = { isEphemeral: false, recipientId: null };
      mockCrypto.encryptSyncMessage.mockResolvedValue(mockEnvelope);
      mockSend.sendMessage.mockReturnValue(of(void 0));

      await service.processScannedQr('qr', myKeys, myAuthUrn);

      expect(mockIdentityResolver.resolveToHandle).toHaveBeenCalledWith(
        myAuthUrn,
      );

      expect(mockEnvelope.recipientId).toBe(myHandleUrn);
      expect(mockEnvelope.recipientId).not.toBe(myAuthUrn);

      expect(mockEnvelope.isEphemeral).toBe(true);
      expect((mockEnvelope as any).priority).toBe(Priority.High);
      expect(mockSend.sendMessage).toHaveBeenCalledWith(mockEnvelope);
    });
  });
});
