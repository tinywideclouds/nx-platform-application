import { TestBed } from '@angular/core/testing';
import { ChatModerationFacade } from './chat-moderation.facade';
// ✅ NEW: Directory Imports
import {
  DirectoryQueryApi,
  DirectoryMutationApi,
} from '@nx-platform-application/directory-api';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

describe('ChatModerationFacade', () => {
  let facade: ChatModerationFacade;
  let dirQuery: DirectoryQueryApi;
  let dirMutation: DirectoryMutationApi;
  let quarantine: QuarantineService;
  let parser: MessageContentParser;

  const blockListUrn = URN.parse('urn:directory:group:block-list');

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatModerationFacade,
        // ✅ Mock Directory Query (State)
        MockProvider(DirectoryQueryApi, {
          getGroup: vi.fn().mockResolvedValue({
            id: blockListUrn,
            memberState: {}, // Initially empty
          }),
        }),
        // ✅ Mock Directory Mutation (Actions)
        MockProvider(DirectoryMutationApi, {
          updateMemberStatus: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(QuarantineService, {
          retrieveForInspection: vi.fn().mockResolvedValue([]),
          reject: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(true),
        }),
        MockProvider(MessageContentParser),
        MockProvider(Logger),
      ],
    });

    facade = TestBed.inject(ChatModerationFacade);
    dirQuery = TestBed.inject(DirectoryQueryApi);
    dirMutation = TestBed.inject(DirectoryMutationApi);
    quarantine = TestBed.inject(QuarantineService);
    parser = TestBed.inject(MessageContentParser);
  });

  describe('Block List State', () => {
    it('should compute blockedSet from Directory Group members', async () => {
      // 1. Mock Directory returning a populated Block List
      vi.mocked(dirQuery.getGroup).mockResolvedValue({
        id: blockListUrn,
        members: [],
        lastUpdated: 'now',
        memberState: {
          'urn:identity:bad-guy': 'joined',
          'urn:identity:ok-guy': 'left',
        },
      } as any);

      // Re-inject to trigger toSignal (or relying on TestBed setup)
      // Note: In a real app, signals might need time to settle or flushEffects
      TestBed.flushEffects();

      // Access signal
      const set = facade.blockedSet();

      // ✅ Verify only 'joined' members are in the Set
      expect(set.has('urn:identity:bad-guy')).toBe(true);
      expect(set.has('urn:identity:ok-guy')).toBe(false);
    });
  });

  describe('Blocking Actions', () => {
    it('should add to Directory Block List and reject from Quarantine', async () => {
      const urn = URN.parse('urn:contacts:user:spammer');

      await facade.block([urn], 'messenger');

      // ✅ Verify Directory Update
      expect(dirMutation.updateMemberStatus).toHaveBeenCalledWith(
        blockListUrn,
        urn,
        'joined',
      );

      // ✅ Verify Quarantine Cleanup
      expect(quarantine.reject).toHaveBeenCalledWith(urn);
    });
  });

  describe('Quarantine Promotion', () => {
    it('should parse and save messages when promoted', async () => {
      const senderUrn = URN.parse('urn:contacts:user:new');
      const mockRawMsg = {
        id: 'm1',
        senderId: senderUrn,
        typeId: URN.parse('urn:message:type:text'),
        payloadBytes: new Uint8Array([1, 2, 3]),
        sentTimestamp: '2023-01-01T00:00:00Z',
      };

      vi.mocked(quarantine.retrieveForInspection).mockResolvedValue([
        mockRawMsg,
      ] as any);

      vi.spyOn(parser, 'parse').mockReturnValue({
        kind: 'content',
        payload: { kind: 'text', text: 'Hello' },
        conversationId: URN.parse('urn:messenger:conv:1'),
        tags: [],
      } as any);

      vi.spyOn(parser, 'serialize').mockReturnValue(new Uint8Array([1, 2, 3]));

      await facade.promoteQuarantinedMessages(senderUrn);

      expect(quarantine.retrieveForInspection).toHaveBeenCalledWith(senderUrn);
      expect(parser.parse).toHaveBeenCalled();

      // Verify Quarantine is cleared
      expect(quarantine.reject).toHaveBeenCalledWith(senderUrn);
    });
  });
});
