import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';
import { MessageClassifier } from './message-classifier.service';

import { MessageSecurityService } from '@nx-platform-application/messenger-infrastructure-message-security';
import {
  MessageContentParser,
  MessageSnippetFactory,
} from '@nx-platform-application/messenger-domain-message-content';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  URN,
  QueuedMessage,
  SecureEnvelope,
} from '@nx-platform-application/platform-types';

describe('MessageClassifier', () => {
  let service: MessageClassifier;
  let parser: MessageContentParser;

  const senderUrn = URN.parse('urn:contacts:user:sender');
  const groupUrn = URN.parse('urn:messenger:group:alpha');

  const mockEnvelope: SecureEnvelope = {
    recipientId: URN.parse('urn:contacts:user:me'),
  } as any;

  const mockQueueItem: QueuedMessage = {
    id: 'msg-123',
    envelope: mockEnvelope,
  };

  const mockTransport: any = {
    typeId: { name: 'Text' },
    payloadBytes: new Uint8Array([]),
    sentTimestamp: '2023-01-01T12:00:00Z',
    clientRecordId: 'client-id-1',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MessageClassifier,
        MockProvider(MessageSecurityService, {
          verifyAndDecrypt: vi.fn().mockResolvedValue(mockTransport),
        }),
        MockProvider(QuarantineService, {
          process: vi.fn().mockResolvedValue(senderUrn),
        }),
        MockProvider(MessageContentParser, {
          parse: vi.fn(),
          serialize: vi.fn().mockReturnValue(new Uint8Array([])),
        }),
        MockProvider(MessageSnippetFactory, {
          createSnippet: vi.fn().mockReturnValue('Snippet'),
        }),
        MockProvider(SessionService, {
          snapshot: { keys: {} } as any,
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(MessageClassifier);
    parser = TestBed.inject(MessageContentParser);
  });

  describe('Content Classification', () => {
    it('should classify standard messages as SLOW-LANE', async () => {
      vi.spyOn(parser, 'parse').mockReturnValue({
        kind: 'content',
        conversationId: senderUrn,
        tags: [],
        payload: { kind: 'text', text: 'Hello' },
      } as any);

      const intent = await service.classify(mockQueueItem, new Set());

      expect(intent.kind).toBe('slow-lane');
      if (intent.kind === 'slow-lane') {
        expect(intent.message.id).toBe('client-id-1'); // Uses client ID if present
        expect(intent.message.snippet).toBe('Snippet');
        expect(intent.message.conversationUrn).toEqual(senderUrn);
      }
    });

    it('should correctly map Group ID for group messages', async () => {
      vi.spyOn(parser, 'parse').mockReturnValue({
        kind: 'content',
        conversationId: groupUrn, // Group URN
        tags: [],
        payload: { kind: 'text', text: 'Group Hello' },
      } as any);

      const intent = await service.classify(mockQueueItem, new Set());

      if (intent.kind === 'slow-lane') {
        expect(intent.message.conversationUrn).toEqual(groupUrn);
      }
    });
  });

  describe('Signal Classification', () => {
    it('should classify Typing Indicators as FAST-LANE', async () => {
      vi.spyOn(parser, 'parse').mockReturnValue({
        kind: 'signal',
        payload: { action: 'typing' },
      } as any);

      const intent = await service.classify(mockQueueItem, new Set());

      expect(intent.kind).toBe('fast-lane');
      if (intent.kind === 'fast-lane') {
        expect(intent.urn).toEqual(senderUrn);
      }
    });

    it('should classify Read Receipts as RECEIPT', async () => {
      vi.spyOn(parser, 'parse').mockReturnValue({
        kind: 'signal',
        payload: { action: 'read-receipt', data: { messageIds: ['m1'] } },
      } as any);

      const intent = await service.classify(mockQueueItem, new Set());

      expect(intent.kind).toBe('receipt');
      if (intent.kind === 'receipt') {
        expect(intent.messageIds).toEqual(['m1']);
      }
    });
  });

  describe('Protocol Classification', () => {
    it('should identify Group Invites', async () => {
      vi.spyOn(parser, 'parse').mockReturnValue({
        kind: 'content',
        payload: { kind: 'group-invite', data: { some: 'invite' } },
      } as any);

      const intent = await service.classify(mockQueueItem, new Set());
      expect(intent.kind).toBe('group-invite');
    });
  });

  describe('Security & Drops', () => {
    it('should DROP if Quarantine returns null (blocked)', async () => {
      const quarantine = TestBed.inject(QuarantineService);
      vi.spyOn(quarantine, 'process').mockResolvedValue(null);

      const intent = await service.classify(mockQueueItem, new Set());
      expect(intent.kind).toBe('drop');
      if (intent.kind === 'drop') {
        expect(intent.reason).toBe('blocked_or_quarantined');
      }
    });

    it('should DROP if decryption fails', async () => {
      const crypto = TestBed.inject(MessageSecurityService);
      vi.spyOn(crypto, 'verifyAndDecrypt').mockRejectedValue(
        new Error('Bad Sig'),
      );

      const intent = await service.classify(mockQueueItem, new Set());
      expect(intent.kind).toBe('drop');
    });
  });
});
