import { TestBed } from '@angular/core/testing';
import { MockChatDataService } from './mock-chat-data.service';
import { URN } from '@nx-platform-application/platform-types';
import { firstValueFrom } from 'rxjs';
import { MockServerNetworkState, MockMessageDef } from '../scenarios.const';

describe('MockChatDataService', () => {
  let service: MockChatDataService;

  const MOCK_MSG_DEF: MockMessageDef = {
    id: 'msg-1',
    senderUrn: URN.parse('urn:contacts:user:alice'),
    text: 'Hello World',
    sentAt: new Date().toISOString(),
    status: 'sent',
  };

  const MOCK_SCENARIO: MockServerNetworkState = {
    queuedMessages: [
      MOCK_MSG_DEF,
      { ...MOCK_MSG_DEF, id: 'msg-2', text: 'Second Message' },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MockChatDataService],
    });
    service = TestBed.inject(MockChatDataService);
  });

  describe('Scenario Loading (Configuration)', () => {
    it('should convert MockMessageDefs to QueuedMessages', async () => {
      // 1. Load Scenario
      service.loadScenario(MOCK_SCENARIO);

      // 2. Fetch result
      const batch = await firstValueFrom(service.getMessageBatch());

      // 3. Verify Conversion
      expect(batch.length).toBe(2);
      expect(batch[0].id).toBe('msg-1');

      // Verify "Encryption" (Mock encoding)
      // The service should have taken "Hello World" and encoded it into the envelope
      const decodedPayload = new TextDecoder().decode(
        batch[0].envelope.encryptedData,
      );
      expect(decodedPayload).toBe('Hello World');
    });

    it('should reset queue when loading a new scenario', async () => {
      service.loadScenario(MOCK_SCENARIO); // Has 2 items
      const batch1 = await firstValueFrom(service.getMessageBatch());
      expect(batch1.length).toBe(2);

      // Load Empty
      service.loadScenario({ queuedMessages: [] });
      const batch2 = await firstValueFrom(service.getMessageBatch());
      expect(batch2.length).toBe(0);
    });
  });

  describe('Interface Compliance (IChatDataService)', () => {
    beforeEach(() => {
      service.loadScenario(MOCK_SCENARIO);
    });

    it('getMessageBatch() should respect limits', async () => {
      // Request only 1
      const batch = await firstValueFrom(service.getMessageBatch(1));
      expect(batch.length).toBe(1);
      expect(batch[0].id).toBe('msg-1');
    });

    it('acknowledge() should remove messages from the queue', async () => {
      // 1. Acknowledge msg-1
      await firstValueFrom(service.acknowledge(['msg-1']));

      // 2. Fetch remaining
      const batch = await firstValueFrom(service.getMessageBatch());

      // 3. Verify msg-1 is gone, msg-2 remains
      expect(batch.length).toBe(1);
      expect(batch[0].id).toBe('msg-2');
    });
  });
});
