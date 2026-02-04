import { TestBed } from '@angular/core/testing';
import { OutboundService } from './outbound.service';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { OutboxStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { SessionService } from '@nx-platform-application/messenger-domain-session';

import { DirectSendStrategy } from './strategies/direct-send.strategy';
import { NetworkGroupStrategy } from './strategies/group-network.strategy';
import { BroadcastStrategy } from './strategies/broadcast.strategy';
import { ContactGroupStrategy } from './strategies/group-contacts.strategy';

import {
  MessageContentParser,
  MessageSnippetFactory,
  TextContent,
  MessageMetadataService,
} from '@nx-platform-application/messenger-domain-message-content';

import { OutboundTarget } from './send-strategy.interface';

describe('OutboundService', () => {
  let service: OutboundService;
  let outboxWorker: OutboxWorkerService;
  let storageService: ChatStorageService;
  let contentParser: MessageContentParser;
  let snippetFactory: MessageSnippetFactory;

  // Strategy Mocks
  let directStrategy: DirectSendStrategy;
  let broadcastStrategy: BroadcastStrategy;

  const myUrn = URN.parse('urn:contacts:user:me');
  const recipientUrn = URN.parse('urn:contacts:user:bob');
  const typeId = URN.parse('urn:message:type:text');

  // Test Data
  const textPayload: TextContent = { kind: 'text', text: 'Hello World' };
  const mockBytes = new Uint8Array([1, 2, 3]);
  const mockEncryptedBytes = new Uint8Array([9, 9, 9]);

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        OutboundService,
        MockProvider(Logger),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(undefined),
          updateMessageStatus: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(OutboxStorage, {
          enqueue: vi.fn().mockResolvedValue('task-1'),
        }),
        MockProvider(IdentityResolver, {
          resolveToHandle: vi
            .fn()
            .mockImplementation((u) => Promise.resolve(u)),
        }),
        MockProvider(OutboxWorkerService, {
          processQueue: vi.fn(),
          sendEphemeralBatch: vi.fn(),
        }),
        MockProvider(MessageMetadataService, {
          wrap: vi.fn().mockReturnValue(mockEncryptedBytes),
        }),
        MockProvider(SessionService, {
          snapshot: { networkUrn: myUrn } as any,
        }),

        // Content Handling Mocks
        MockProvider(MessageContentParser, {
          serialize: vi.fn().mockReturnValue(mockBytes),
          parse: vi.fn().mockReturnValue({
            kind: 'content',
            payload: textPayload,
          }),
        }),
        MockProvider(MessageSnippetFactory, {
          createSnippet: vi.fn().mockReturnValue('Snippet: Hello World'),
        }),

        // Strategy Mocks
        MockProvider(DirectSendStrategy),
        MockProvider(NetworkGroupStrategy),
        MockProvider(BroadcastStrategy),
        MockProvider(ContactGroupStrategy),
      ],
    });

    service = TestBed.inject(OutboundService);
    outboxWorker = TestBed.inject(OutboxWorkerService);
    storageService = TestBed.inject(ChatStorageService);
    contentParser = TestBed.inject(MessageContentParser);
    snippetFactory = TestBed.inject(MessageSnippetFactory);

    directStrategy = TestBed.inject(DirectSendStrategy);
    broadcastStrategy = TestBed.inject(BroadcastStrategy);
  });

  describe('sendFromConversation (Rich Handoff)', () => {
    it('should serialize Object, generate Snippet, and Persist', async () => {
      // Setup Strategy response
      const targets: OutboundTarget[] = [
        {
          conversationUrn: recipientUrn,
          recipients: [recipientUrn],
        },
      ];
      vi.spyOn(directStrategy, 'getTargets').mockResolvedValue(targets);

      // Act
      const result = await service.sendFromConversation(
        recipientUrn,
        typeId,
        textPayload,
      );

      // Assert 1: Serialization & Snippet
      expect(contentParser.serialize).toHaveBeenCalledWith(textPayload);
      expect(snippetFactory.createSnippet).toHaveBeenCalledWith(
        expect.objectContaining({ payload: textPayload }),
      );

      // Assert 2: Persistence (Centralized in OutboundService now)
      expect(storageService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          snippet: 'Snippet: Hello World',
          payloadBytes: mockBytes,
          status: 'pending',
        }),
      );

      // Assert 3: Return Value
      expect(result.message.snippet).toBe('Snippet: Hello World');
      expect(result.message.payloadBytes).toBe(mockBytes);
    });

    it('should parse Uint8Array to generate Snippet if bytes are passed', async () => {
      vi.spyOn(directStrategy, 'getTargets').mockResolvedValue([]);

      // Act
      await service.sendFromConversation(recipientUrn, typeId, mockBytes);

      // Assert: Reverse Parse
      expect(contentParser.parse).toHaveBeenCalledWith(typeId, mockBytes);
      expect(snippetFactory.createSnippet).toHaveBeenCalled();

      // Assert: Persistence
      expect(storageService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadBytes: mockBytes,
          snippet: 'Snippet: Hello World',
        }),
      );
    });
  });

  describe('broadcast (Explicit Fan-Out)', () => {
    it('should use BroadcastStrategy and set recipients on context', async () => {
      const invitees = [
        URN.parse('urn:identity:google:alice'),
        URN.parse('urn:identity:google:bob'),
      ];
      const groupUrn = URN.parse('urn:messenger:group:123');

      // Setup Broadcast Strategy to just return targets (it logic is tested elsewhere)
      vi.spyOn(broadcastStrategy, 'getTargets').mockResolvedValue([
        { conversationUrn: invitees[0], recipients: [invitees[0]] },
        { conversationUrn: invitees[1], recipients: [invitees[1]] },
      ]);

      await service.broadcast(invitees, groupUrn, typeId, textPayload);

      // Assert
      expect(broadcastStrategy.getTargets).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: invitees,
          conversationUrn: groupUrn,
        }),
      );

      // Verify storage was called (default is shouldPersist: true)
      expect(storageService.saveMessage).toHaveBeenCalled();
    });
  });

  describe('Orchestration & Worker Trigger', () => {
    it('should trigger worker only AFTER enqueuing tasks', async () => {
      // Setup a valid target so we actually execute the persistent send logic
      vi.spyOn(directStrategy, 'getTargets').mockResolvedValue([
        {
          conversationUrn: recipientUrn,
          recipients: [recipientUrn],
        },
      ]);

      await service.sendFromConversation(recipientUrn, typeId, textPayload);

      // Assert Worker Triggered
      expect(outboxWorker.processQueue).toHaveBeenCalled();
    });

    it('should handle failures gracefully (update status to failed)', async () => {
      // Setup Strategy to throw
      vi.spyOn(directStrategy, 'getTargets').mockRejectedValue(
        new Error('Routing Error'),
      );

      const result = await service.sendFromConversation(
        recipientUrn,
        typeId,
        textPayload,
      );

      // Assert Error Handling
      expect(storageService.updateMessageStatus).toHaveBeenCalledWith(
        [result.message.id],
        'failed',
      );

      // Result should indicate failure but return the optimistic message
      await expect(result.outcome).resolves.toBe('failed');
    });
  });
});
