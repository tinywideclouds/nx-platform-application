import { TestBed } from '@angular/core/testing';
import { ChatMediaFacade } from './chat-media.facade';
import { AssetStorageService } from '@nx-platform-application/messenger-infrastructure-asset-storage';
import {
  ConversationActionService,
  ConversationService,
} from '@nx-platform-application/messenger-domain-conversation';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

describe('ChatMediaFacade', () => {
  let facade: ChatMediaFacade;
  let assetStorage: AssetStorageService;
  let actions: ConversationActionService;
  let conversation: ConversationService;
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
          upload: vi.fn().mockResolvedValue({
            url: 'https://cloud.com/img.png',
            provider: 'google',
          }),
        }),
        MockProvider(ConversationActionService, {
          sendAssetReveal: vi.fn().mockResolvedValue(undefined),
          sendImage: vi.fn().mockResolvedValue('m1'),
        }),
        MockProvider(ConversationService, {
          reloadMessages: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatStorageService, {
          getMessage: vi.fn().mockResolvedValue({
            id: 'm1',
            typeId: 'img',
            payloadBytes: new Uint8Array([1]),
          }),
          updateMessagePayload: vi.fn().mockResolvedValue(undefined),
        }),
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
    conversation = TestBed.inject(ConversationService);
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
    await facade['processBackgroundUpload'](
      mockRecipient,
      'm1',
      mockFile,
      mockKeys,
      mockUrn,
      'driveImage',
    );

    // Assert 1: Upload
    expect(assetStorage.upload).toHaveBeenCalledWith(mockFile);

    // Assert 2: Signal
    expect(actions.sendAssetReveal).toHaveBeenCalledWith(
      mockRecipient,
      expect.objectContaining({
        messageId: 'm1',
        assets: {
          driveImage: {
            url: 'https://cloud.com/img.png',
            provider: 'google',
          },
        },
      }),
      mockKeys,
      mockUrn,
    );

    // Assert 3: Patch
    expect(storage.getMessage).toHaveBeenCalledWith('m1');

    // ✅ FIX: Expect the new 'assets' structure, not the flat 'remoteUrl'
    expect(parser.serialize).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: {
          driveImage: {
            url: 'https://cloud.com/img.png',
            provider: 'google',
          },
        },
      }),
    );

    expect(storage.updateMessagePayload).toHaveBeenCalledWith(
      'm1',
      expect.any(Uint8Array),
    );

    // Assert 4: UI Refresh
    expect(conversation.reloadMessages).toHaveBeenCalledWith(['m1']);
  });

  it('should catch and log errors during upload', async () => {
    vi.spyOn(assetStorage, 'upload').mockRejectedValue(
      new Error('Network Fail'),
    );

    await expect(
      facade['processBackgroundUpload'](
        mockRecipient,
        'm1',
        mockFile,
        mockKeys,
        mockUrn,
        'driveImage',
      ),
    ).rejects.toThrow('Network Fail');

    expect(actions.sendAssetReveal).not.toHaveBeenCalled();
  });
});
