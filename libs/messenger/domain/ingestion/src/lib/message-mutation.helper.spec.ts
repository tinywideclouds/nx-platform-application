import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';
import { MessageMutationHelper } from './message-mutation.helper';

import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { AssetRevealData } from '@nx-platform-application/messenger-domain-message-content';

describe('MessageMutationHelper', () => {
  let service: MessageMutationHelper;
  let storage: ChatStorageService;
  let parser: MessageContentParser;

  const mockPatch: AssetRevealData = {
    messageId: 'msg-1',
    assets: {
      'asset-001': { resourceId: 'res-123', provider: 'google-drive' },
    },
  };

  const mockExistingMsg: any = {
    id: 'msg-1',
    typeId: { name: 'Text' },
    payloadBytes: new Uint8Array([1, 2, 3]),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MessageMutationHelper,
        // ✅ FIX: Explicitly provide vi.fn() so 'expect' sees a Spy
        MockProvider(ChatStorageService, {
          getMessage: vi.fn(),
          updateMessagePayload: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(MessageContentParser, {
          parse: vi.fn(),
          serialize: vi.fn(),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(MessageMutationHelper);
    storage = TestBed.inject(ChatStorageService);
    parser = TestBed.inject(MessageContentParser);
  });

  describe('applyAssetReveal', () => {
    it('should successfully patch a content message', async () => {
      // 1. Mock Fetch
      vi.mocked(storage.getMessage).mockResolvedValue(mockExistingMsg);

      // 2. Mock Parse
      vi.mocked(parser.parse).mockReturnValue({
        kind: 'content',
        payload: { text: 'Hello', assets: {} },
      } as any);

      // 3. Mock Serialize
      const newBytes = new Uint8Array([9, 9, 9]);
      vi.mocked(parser.serialize).mockReturnValue(newBytes);

      // 4. Execute
      const result = await service.applyAssetReveal(mockPatch);

      // 5. Verify
      expect(result).toBe('msg-1');

      expect(parser.serialize).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello',
          assets: mockPatch.assets,
        }),
      );

      expect(storage.updateMessagePayload).toHaveBeenCalledWith(
        'msg-1',
        newBytes,
      );
    });

    it('should return NULL if message not found', async () => {
      vi.mocked(storage.getMessage).mockResolvedValue(undefined);
      const result = await service.applyAssetReveal(mockPatch);
      expect(result).toBeNull();
      expect(storage.updateMessagePayload).not.toHaveBeenCalled();
    });

    it('should return NULL if message is not content type', async () => {
      vi.mocked(storage.getMessage).mockResolvedValue(mockExistingMsg);
      vi.mocked(parser.parse).mockReturnValue({ kind: 'signal' } as any);

      const result = await service.applyAssetReveal(mockPatch);
      expect(result).toBeNull();
      expect(storage.updateMessagePayload).not.toHaveBeenCalled();
    });
  });
});
