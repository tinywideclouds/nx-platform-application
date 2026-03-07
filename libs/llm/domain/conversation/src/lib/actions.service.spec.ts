import { TestBed } from '@angular/core/testing';
import { LlmChatActions } from './actions.service';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { ProposalRegistryStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import {
  LLM_NETWORK_CLIENT,
  LlmStreamEvent,
} from '@nx-platform-application/llm-infrastructure-client-access';
import { LlmContextBuilderService } from './context-builder.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

describe('LlmChatActions', () => {
  let service: LlmChatActions;
  let streamSubject: Subject<LlmStreamEvent>;

  const mockLogger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const mockSink = {
    addMessage: vi.fn(),
    updateMessagePayload: vi.fn(),
    flush: vi.fn(),
    setLoading: vi.fn(),
    removeMessage: vi.fn(),
    updateMessageTags: vi.fn(),
    removeMessages: vi.fn(),
    updateMessageExclusions: vi.fn(),
  };
  const mockSessionSource = {
    sessions: signal([
      {
        id: URN.parse('urn:llm:session:123'),
        attachments: [{ cacheId: URN.parse('urn:llm:cache:base') }],
      },
    ]),
    refresh: vi.fn(),
  };
  const mockStorage = {
    saveMessage: vi.fn().mockResolvedValue(true),
    deleteMessages: vi.fn().mockResolvedValue(true),
    getSession: vi.fn(),
    saveSession: vi.fn(),
    getMessage: vi.fn(),
    updateMessageExclusions: vi.fn(),
  };
  const mockRegistry = {
    saveProposal: vi.fn().mockResolvedValue(true),
  };
  const mockBuilder = {
    buildStreamRequest: vi
      .fn()
      .mockResolvedValue({ request: {}, memoryMetrics: {} }),
  };
  const mockNetwork = { generateStream: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    streamSubject = new Subject<LlmStreamEvent>();
    mockNetwork.generateStream.mockReturnValue(streamSubject.asObservable());

    TestBed.configureTestingModule({
      providers: [
        LlmChatActions,
        { provide: Logger, useValue: mockLogger },
        { provide: LlmScrollSource, useValue: mockSink },
        { provide: LlmSessionSource, useValue: mockSessionSource },
        { provide: LlmStorageService, useValue: mockStorage },
        { provide: ProposalRegistryStorageService, useValue: mockRegistry },
        { provide: LlmContextBuilderService, useValue: mockBuilder },
        { provide: LLM_NETWORK_CLIENT, useValue: mockNetwork },
      ],
    });
    service = TestBed.inject(LlmChatActions);
  });

  it('should route stream events perfectly between text chunks and proposals', async () => {
    const sessionId = URN.parse('urn:llm:session:123');

    // 1. Start generation
    await service.sendMessage('Fix the bug', sessionId);

    // Ephemeral Queue Verify: We only pass the request object
    expect(mockNetwork.generateStream).toHaveBeenCalledWith(expect.anything());

    // 2. Emit a Standard Text Chunk
    streamSubject.next({ type: 'text', content: 'I will propose a fix.' });

    // Verifies the placeholder text was updated
    expect(mockSink.updateMessagePayload).toHaveBeenCalled();
    expect(service.activeProposal()).toBeNull();

    // 3. Emit a Tool Interception Proposal
    streamSubject.next({
      type: 'proposal',
      event: {
        originalContent: 'old',
        proposal: {
          id: 'prop-123',
          sessionId: 's1',
          filePath: 'main.ts',
          patch: '@@ -1 +1 @@\n+ new code',
          reasoning: 'fix',
          status: 'pending',
          createdAt: 'now' as ISODateTimeString,
        },
      },
    });

    // Wait for microtasks to resolve to ensure the registry save is caught
    await new Promise(process.nextTick);

    // Verify the heavy payload was routed to the Global Registry
    expect(mockRegistry.saveProposal).toHaveBeenCalled();
    const registryArg = mockRegistry.saveProposal.mock.calls[0][0];
    expect(registryArg.filePath).toBe('main.ts');
    expect(registryArg.patch).toBe('@@ -1 +1 @@\n+ new code');
    expect(registryArg.id.toString()).toBe('urn:llm:proposal:prop-123');

    // Verify a brand new lightweight pointer was pushed to the sink
    expect(mockSink.addMessage).toHaveBeenCalledTimes(3); // 1 User, 1 Text Placeholder, 1 New Pointer
    const lastAddedMessage = mockSink.addMessage.mock.calls[2][0];
    expect(lastAddedMessage.role).toBe('model');
    expect(lastAddedMessage.typeId.toString()).toBe(
      'urn:llm:message-type:fileLink',
    );

    // Verify the pointer JSON was encoded correctly into the payload
    const decoder = new TextDecoder();
    const payloadStr = decoder.decode(lastAddedMessage.payloadBytes);
    const pointerPayload = JSON.parse(payloadStr);

    expect(pointerPayload.proposalId).toBe('urn:llm:proposal:prop-123');
    expect(pointerPayload.filePath).toBe('main.ts');
    expect(pointerPayload.snippet).toContain('+ new code'); // The patch was stripped down to a preview
  });

  it('should ensure the assistant placeholder timestamp is strictly 1ms after the user message', async () => {
    const sessionId = URN.parse('urn:llm:session:123');

    await service.sendMessage('Hello', sessionId);

    expect(mockStorage.saveMessage).toHaveBeenCalledTimes(2);

    const userMsg = mockStorage.saveMessage.mock.calls[0][0];
    const placeholderMsg = mockStorage.saveMessage.mock.calls[1][0];

    expect(userMsg.role).toBe('user');
    expect(placeholderMsg.role).toBe('assistant');

    const userTime = Temporal.Instant.from(userMsg.timestamp);
    const placeholderTime = Temporal.Instant.from(placeholderMsg.timestamp);

    // Assert that the difference is exactly 1 millisecond
    expect(placeholderTime.epochMilliseconds).toBe(
      userTime.epochMilliseconds + 1,
    );
  });
});
