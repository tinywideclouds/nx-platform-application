import { TestBed } from '@angular/core/testing';
import { LlmChatActions } from './actions.service';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
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
    expect(mockSink.updateMessagePayload).toHaveBeenCalled();
    expect(service.activeProposal()).toBeNull();

    // 3. Emit a Tool Interception Proposal
    streamSubject.next({
      type: 'proposal',
      event: {
        originalContent: 'old',
        proposal: {
          id: 'p1',
          sessionId: 's1',
          filePath: 'main.ts',
          patch: '@@ -1 +1 @@',
          reasoning: 'fix',
          status: 'pending',
          createdAt: 'now',
        },
      },
    });

    expect(service.activeProposal()?.originalContent).toBe('old');
    expect(service.activeProposal()?.proposal.id).toBe('p1');
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
