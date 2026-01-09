import { TestBed } from '@angular/core/testing';
import { ChatModerationFacade } from './chat-moderation.facade';
import { GatekeeperApi } from '@nx-platform-application/contacts-api';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { BehaviorSubject } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

describe('ChatModerationFacade', () => {
  let facade: ChatModerationFacade;
  let gatekeeper: GatekeeperApi;
  let quarantine: QuarantineService;
  let storage: ChatStorageService;
  let parser: MessageContentParser;

  const mockBlocked$ = new BehaviorSubject([]);

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatModerationFacade,
        {
          provide: GatekeeperApi,
          useValue: {
            blocked$: mockBlocked$,
            blockIdentity: vi.fn().mockResolvedValue(undefined),
          },
        },
        MockProvider(QuarantineService, {
          reject: vi.fn().mockResolvedValue(undefined),
          retrieveForInspection: vi.fn().mockResolvedValue([]),
        }),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(undefined),
        }),
        // Fix: Explicitly initialize the methods we intend to spy on
        MockProvider(MessageContentParser, {
          parse: vi.fn(),
          serialize: vi.fn(),
        }),
        MockProvider(Logger),
      ],
    });

    facade = TestBed.inject(ChatModerationFacade);
    gatekeeper = TestBed.inject(GatekeeperApi);
    quarantine = TestBed.inject(QuarantineService);
    storage = TestBed.inject(ChatStorageService);
    parser = TestBed.inject(MessageContentParser);
  });

  describe('Block List Management', () => {
    it('should filter blocked identities for messenger scope', () => {
      const urn = 'urn:contacts:user:spammer';

      mockBlocked$.next([
        { urn: URN.parse(urn), scopes: ['messenger'] },
        { urn: URN.parse('urn:contacts:user:other'), scopes: ['email'] },
      ] as any);

      const set = facade.blockedSet();
      expect(set.has(urn)).toBe(true);
      expect(set.has('urn:contacts:user:other')).toBe(false);
    });

    it('should block identity and reject pending messages', async () => {
      const urn = URN.parse('urn:contacts:user:bad');
      await facade.block([urn]);

      expect(gatekeeper.blockIdentity).toHaveBeenCalledWith(urn, ['messenger']);
      expect(quarantine.reject).toHaveBeenCalledWith(urn);
    });
  });

  describe('Quarantine Promotion', () => {
    it('should parse and save messages when promoted', async () => {
      const senderUrn = URN.parse('urn:contacts:user:new');
      const mockRawMsg = {
        id: 'm1',
        senderId: senderUrn,
        typeId: 'text/plain',
        payloadBytes: new Uint8Array([1, 2, 3]),
        sentTimestamp: '2023-01-01T00:00:00Z',
      };

      vi.spyOn(quarantine, 'retrieveForInspection').mockResolvedValue([
        mockRawMsg,
      ] as any);

      // Now safe to spy because we initialized it in MockProvider
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
      expect(storage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'm1',
          textContent: 'Hello',
          status: 'received',
        }),
      );
      expect(quarantine.reject).toHaveBeenCalledWith(senderUrn);
    });
  });
});
