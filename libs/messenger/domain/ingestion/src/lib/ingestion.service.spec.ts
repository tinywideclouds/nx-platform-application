import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { IngestionService } from './ingestion.service';
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';

import { MessageClassifier } from './message-classifier.service';
import { MessageMutationHelper } from './message-mutation.helper';
import { AssetRevealData } from '@nx-platform-application/messenger-domain-message-content';

describe('IngestionService', () => {
  let service: IngestionService;
  let dataService: ChatDataService;
  let classifier: MessageClassifier;
  let storage: ChatStorageService;
  let mutationHelper: MessageMutationHelper;

  // Mock Objects
  const senderUrn = URN.parse('urn:contacts:user:alice');
  const mockBatch = [
    { id: 'q1', envelope: {} },
    { id: 'q2', envelope: {} },
  ] as any[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IngestionService,
        MockProvider(ChatDataService, {
          getAllMessages: vi.fn().mockReturnValue(of(mockBatch)), // Stream returns 1 batch
          acknowledge: vi.fn().mockReturnValue(of(void 0)),
        }),
        MockProvider(MessageClassifier),
        MockProvider(MessageMutationHelper),
        MockProvider(ChatStorageService, {
          bulkSaveMessages: vi.fn().mockResolvedValue(undefined),
          applyReceipt: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(GroupProtocolService),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(IngestionService);
    dataService = TestBed.inject(ChatDataService);
    classifier = TestBed.inject(MessageClassifier);
    storage = TestBed.inject(ChatStorageService);
    mutationHelper = TestBed.inject(MessageMutationHelper);
  });

  describe('The Pipeline', () => {
    it('should split processing into Fast Lane and Slow Lane correctly', async () => {
      // SETUP: Classifier returns mixed intents
      vi.spyOn(classifier, 'classify')
        .mockResolvedValueOnce({
          kind: 'fast-lane',
          urn: senderUrn,
          payload: {},
        }) // Item 1: Typing
        .mockResolvedValueOnce({
          kind: 'slow-lane',
          message: { id: 'msg-real' } as any,
        }); // Item 2: Message

      // Spy on the output stream
      const emissionSpy = vi.fn();
      service.dataIngested$.subscribe(emissionSpy);

      // EXECUTE
      await service.process(new Set());

      // VERIFY: Fast Lane
      // Expect first emission to be ONLY typing (no messages)
      expect(emissionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          typingIndicators: [senderUrn],
          messages: [],
        }),
      );

      // VERIFY: Slow Lane (Storage)
      expect(storage.bulkSaveMessages).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'msg-real' })]),
      );

      // VERIFY: Slow Lane (Notification)
      // Expect second emission to contain the message (AFTER storage)
      expect(emissionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ id: 'msg-real' }),
          ]),
        }),
      );

      // VERIFY: Acknowledge
      // Must ack both IDs (q1 and q2)
      expect(dataService.acknowledge).toHaveBeenCalledWith(['q1', 'q2']);
    });

    it('should handle Asset Reveal mutations via the helper', async () => {
      // SETUP: Classifier returns a mutation intent
      const mockPatch: AssetRevealData = {
        messageId: 'm1',
        assets: {
          'asset-001': { resourceId: 'res-123', provider: 'google-drive' },
        },
      };

      vi.spyOn(dataService, 'getAllMessages').mockReturnValue(
        of([mockBatch[0]]),
      );
      vi.spyOn(classifier, 'classify').mockResolvedValue({
        kind: 'asset-reveal',
        patch: mockPatch,
      });

      // Mock helper success
      vi.spyOn(mutationHelper, 'applyAssetReveal').mockResolvedValue('m1');

      const emissionSpy = vi.fn();
      service.dataIngested$.subscribe(emissionSpy);

      // EXECUTE
      await service.process(new Set());

      // VERIFY
      expect(mutationHelper.applyAssetReveal).toHaveBeenCalledWith(mockPatch);

      // Should emit the patched ID
      expect(emissionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          patchedMessageIds: ['m1'],
        }),
      );
    });
  });
});
