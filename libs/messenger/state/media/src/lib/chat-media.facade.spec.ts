import { TestBed } from '@angular/core/testing';
import { ChatMediaFacade } from './chat-media.facade';
import { AssetStorageService } from '@nx-platform-application/messenger-infrastructure-asset-storage';
import { ConversationActionService } from '@nx-platform-application/messenger-domain-conversation';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

describe('ChatMediaFacade', () => {
  let facade: ChatMediaFacade;
  let assetStorage: AssetStorageService;
  let actions: ConversationActionService;
  let storage: ChatStorageService;
  let parser: MessageContentParser;

  const mockUrn = URN.parse('urn:contacts:user:me');
  const mockRecipient = URN.parse('urn:contacts:user:bob');
  const mockKeys = { encKey: 'k' } as any;
  const mockFile = new File([''], 'test.png');

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatMediaFacade,
        MockProvider(AssetStorageService, {
          upload: vi.fn().mockResolvedValue('https://cloud.com/img.png'),
        }),
        MockProvider(ConversationActionService, {
          sendAssetReveal: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatStorageService, {
          getMessage: vi.fn().mockResolvedValue({
            id: 'm1',
            typeId: 'img',
            payloadBytes: new Uint8Array([1]),
          }),
          updateMessagePayload: vi.fn().mockResolvedValue(undefined),
        }),
        // Explicitly initialize parser methods to avoid "does not exist" error
        MockProvider(MessageContentParser, {
          parse: vi.fn(),
          serialize: vi.fn(),
        }),
        MockProvider(Logger),
      ],
    });

    facade = TestBed.inject(ChatMediaFacade);
    assetStorage = TestBed.inject(AssetStorageService);
    actions = TestBed.inject(ConversationActionService);
    storage = TestBed.inject(ChatStorageService);
    parser = TestBed.inject(MessageContentParser);
  });

  it('should upload file, send signal, and patch local DB', async () => {
    // Setup Parser Mocks
    vi.spyOn(parser, 'parse').mockReturnValue({
      kind: 'content',
      payload: { kind: 'image', remoteUrl: null },
      conversationId: mockRecipient,
      tags: [],
    } as any);
    vi.spyOn(parser, 'serialize').mockReturnValue(new Uint8Array([2]));

    // Act
    await facade.processBackgroundUpload(
      'bob' as any,
      'm1',
      mockFile,
      mockKeys,
      mockUrn,
    );

    // Assert 1: Upload
    expect(assetStorage.upload).toHaveBeenCalledWith(mockFile);

    // Assert 2: Signal
    expect(actions.sendAssetReveal).toHaveBeenCalledWith(
      'bob',
      { messageId: 'm1', remoteUrl: 'https://cloud.com/img.png' },
      mockKeys,
      mockUrn,
    );

    // Assert 3: Patch
    expect(storage.getMessage).toHaveBeenCalledWith('m1');
    expect(parser.serialize).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteUrl: 'https://cloud.com/img.png',
      }),
    );
    expect(storage.updateMessagePayload).toHaveBeenCalledWith(
      'm1',
      expect.any(Uint8Array),
    );
  });

  it('should catch and log errors during upload', async () => {
    vi.spyOn(assetStorage, 'upload').mockRejectedValue(
      new Error('Network Fail'),
    );

    // Should not throw
    await facade.processBackgroundUpload(
      'bob' as any,
      'm1',
      mockFile,
      mockKeys,
      mockUrn,
    );

    expect(actions.sendAssetReveal).not.toHaveBeenCalled();
    expect(storage.updateMessagePayload).not.toHaveBeenCalled();
  });
});
