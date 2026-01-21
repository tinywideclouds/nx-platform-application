import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MockLiveService } from './mock-live.service';
import { firstValueFrom } from 'rxjs';
import { MockServerNetworkState, MockMessageDef } from '../scenarios.const';
import { URN } from '@nx-platform-application/platform-types';

describe('MockLiveService', () => {
  let service: MockLiveService;

  const MOCK_MSG: MockMessageDef = {
    id: 'msg-1',
    senderUrn: URN.parse('urn:contacts:user:alice'),
    text: 'Hi',
    sentAt: new Date().toISOString(),
    status: 'sent',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MockLiveService],
    });
    service = TestBed.inject(MockLiveService);
  });

  describe('Scenario Loading (Configuration)', () => {
    it('should connect IMMEDIATELY if the queue is empty (Happy Path)', async () => {
      // 1. Load Empty Scenario
      service.loadScenario({ queuedMessages: [] });

      // 2. Expect 'connected' right away
      const status = await firstValueFrom(service.status$);
      expect(status).toBe('connected');
    });

    it('should connect with DELAY if queue has messages (Fetch Trigger Logic)', fakeAsync(() => {
      // 1. Subscribe to track emissions
      const emissions: string[] = [];
      service.status$.subscribe((s) => emissions.push(s));

      // 2. Load Scenario with Messages
      service.loadScenario({ queuedMessages: [MOCK_MSG] });

      // 3. Initial state should be 'connecting' (reset)
      expect(emissions[emissions.length - 1]).toBe('connecting');

      // 4. Fast forward time (simulate 500ms delay)
      tick(500);

      // 5. Expect transition to 'connected'
      expect(emissions[emissions.length - 1]).toBe('connected');
    }));
  });

  describe('Interface Compliance (IChatLiveDataService)', () => {
    it('disconnect() should update status to disconnected', async () => {
      service.disconnect();
      const status = await firstValueFrom(service.status$);
      expect(status).toBe('disconnected');
    });

    // Connect is usually a no-op in Mock/Auto-connect scenarios,
    // but we ensure it doesn't crash.
    it('connect() should be safe to call', () => {
      expect(() => service.connect(() => 'token')).not.toThrow();
    });
  });
});
