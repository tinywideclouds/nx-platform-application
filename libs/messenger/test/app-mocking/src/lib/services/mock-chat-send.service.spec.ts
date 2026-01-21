import { TestBed } from '@angular/core/testing';
import { MockChatSendService } from './mock-chat-send.service';
import { SecureEnvelope, URN } from '@nx-platform-application/platform-types';
import { firstValueFrom } from 'rxjs';
import { MockChatSendConfig } from '../scenarios.const';

describe('MockChatSendService', () => {
  let service: MockChatSendService;

  const MOCK_ENVELOPE: SecureEnvelope = {
    recipientId: URN.parse('urn:contacts:user:alice'),
    encryptedData: new Uint8Array([1, 2, 3]),
    encryptedSymmetricKey: new Uint8Array([0]),
    signature: new Uint8Array([0]),
    isEphemeral: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MockChatSendService],
    });
    service = TestBed.inject(MockChatSendService);
  });

  describe('Scenario Loading', () => {
    it('should default to "Success" (Happy Path)', async () => {
      await expect(
        firstValueFrom(service.sendMessage(MOCK_ENVELOPE)),
      ).resolves.toBeUndefined();
    });

    it('should handle "Send Failure" scenario', async () => {
      // 1. Load Failure Scenario
      service.loadScenario({ shouldFail: true, errorMsg: 'Simulated 500' });

      // 2. Expect Error
      await expect(
        firstValueFrom(service.sendMessage(MOCK_ENVELOPE)),
      ).rejects.toThrow('Simulated 500');
    });

    it('should recover when switching back to "Success" scenario', async () => {
      // 1. Fail
      service.loadScenario({ shouldFail: true });
      await expect(
        firstValueFrom(service.sendMessage(MOCK_ENVELOPE)),
      ).rejects.toThrow();

      // 2. Recover
      service.loadScenario({ shouldFail: false });
      await expect(
        firstValueFrom(service.sendMessage(MOCK_ENVELOPE)),
      ).resolves.toBeUndefined();
    });
  });
});
