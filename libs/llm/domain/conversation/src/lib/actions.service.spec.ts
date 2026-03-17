import { TestBed } from '@angular/core/testing';
import { LlmChatActions } from './actions.service';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  MessageStorageService,
  SessionStorageService,
  ProposalRegistryStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
import { LlmScrollSource } from '@nx-platform-application/llm-features-chat';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import {
  LLM_NETWORK_CLIENT,
  LlmStreamEvent,
} from '@nx-platform-application/llm-infrastructure-client-access';
import { LlmContextBuilderService } from '@nx-platform-application/llm-domain-context';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';

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
        strategy: { enablePreFlightPreview: false },
        inlineContexts: [],
        systemContexts: [],
        compiledContext: undefined,
        quickContext: [],
      },
    ]),
    refresh: vi.fn(),
  };

  const mockMessageStorage = {
    saveMessage: vi.fn().mockResolvedValue(true),
    deleteMessages: vi.fn().mockResolvedValue(true),
    getMessage: vi.fn(),
    updateMessageExclusions: vi.fn(),
  };

  const mockSessionStorage = {
    getSession: vi.fn().mockResolvedValue({
      id: URN.parse('urn:llm:session:123'),
      inlineContexts: [],
      systemContexts: [],
      quickContext: [],
    }),
    saveSession: vi.fn(),
  };

  const mockRegistry = {
    saveProposal: vi.fn().mockResolvedValue(true),
  };
  const mockProposalService = {
    saveChangeProposal: vi.fn().mockResolvedValue(true),
  };

  const mockBuilder = {
    buildStreamRequest: vi
      .fn()
      .mockResolvedValue({ request: { history: [] }, memoryMetrics: {} }),
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
        { provide: MessageStorageService, useValue: mockMessageStorage },
        { provide: SessionStorageService, useValue: mockSessionStorage },
        { provide: ProposalRegistryStorageService, useValue: mockRegistry },
        { provide: LlmProposalService, useValue: mockProposalService },
        { provide: LlmContextBuilderService, useValue: mockBuilder },
        { provide: LLM_NETWORK_CLIENT, useValue: mockNetwork },
      ],
    });
    service = TestBed.inject(LlmChatActions);
  });

  it('should route stream events perfectly between text chunks and proposals', async () => {
    const sessionId = URN.parse('urn:llm:session:123');

    await service.sendMessage('Fix the bug', sessionId);
    expect(mockNetwork.generateStream).toHaveBeenCalledWith(expect.anything());

    streamSubject.next({ type: 'text', content: 'I will propose a fix.' });
    expect(mockSink.updateMessagePayload).toHaveBeenCalled();
    expect(service.activeProposal()).toBeNull();

    streamSubject.next({
      type: 'proposal',
      event: {
        originalContent: 'old',
        proposal: {
          id: 'prop-123',
          sessionId: URN.parse('urn:llm:session:s1'),
          filePath: 'main.ts',
          patch: '@@ -1 +1 @@\n+ new code',
          reasoning: 'fix',
          status: 'pending',
          createdAt: 'now' as ISODateTimeString,
        },
      },
    });

    await new Promise(process.nextTick);

    expect(mockProposalService.saveChangeProposal).toHaveBeenCalled();

    expect(mockSink.addMessage).toHaveBeenCalledTimes(3);
    const lastAddedMessage = mockSink.addMessage.mock.calls[2][0];
    expect(lastAddedMessage.role).toBe('model');
    expect(lastAddedMessage.typeId.toString()).toBe(
      'urn:llm:message-type:fileLink',
    );
  });

  it('should cleanly accumulate and reset ephemeral thought states', async () => {
    const sessionId = URN.parse('urn:llm:session:123');

    await service.sendMessage('Plan the task', sessionId);

    streamSubject.next({
      type: 'thought',
      content: 'First, I need to check the ',
    });
    streamSubject.next({ type: 'thought', content: 'logs.' });

    expect(service.activeThought()).toBe('First, I need to check the logs.');

    streamSubject.complete();
    expect(service.activeThought()).toBe('');
  });

  it('should intercept the network call if pre-flight preview is enabled and halted by user', async () => {
    mockSessionSource.sessions.set([
      {
        id: URN.parse('urn:llm:session:123'),
        strategy: { enablePreFlightPreview: true },
        inlineContexts: [],
        systemContexts: [],
        quickContext: [],
      } as any,
    ]);

    const mockOnPreflight = vi
      .fn()
      .mockResolvedValue({ send: false, disableFuture: false });

    await service.sendMessage('Check this', URN.parse('urn:llm:session:123'), {
      onPreflight: mockOnPreflight,
    });

    expect(mockOnPreflight).toHaveBeenCalled();
    expect(mockNetwork.generateStream).not.toHaveBeenCalled();
    expect(mockSink.setLoading).toHaveBeenCalledWith(false);
  });

  it('should proceed with network call and disable future previews if instructed by delegated hook', async () => {
    mockSessionSource.sessions.set([
      {
        id: URN.parse('urn:llm:session:123'),
        strategy: { enablePreFlightPreview: true },
        inlineContexts: [],
        systemContexts: [],
        quickContext: [],
      } as any,
    ]);

    const mockOnPreflight = vi
      .fn()
      .mockResolvedValue({ send: true, disableFuture: true });

    await service.sendMessage('Check this', URN.parse('urn:llm:session:123'), {
      onPreflight: mockOnPreflight,
    });

    expect(mockOnPreflight).toHaveBeenCalled();
    expect(mockSessionStorage.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: expect.objectContaining({ enablePreFlightPreview: false }),
      }),
    );
    expect(mockNetwork.generateStream).toHaveBeenCalled();
  });

  it('should ensure the assistant placeholder timestamp is strictly 1ms after the user message', async () => {
    mockSessionSource.sessions.set([
      {
        id: URN.parse('urn:llm:session:123'),
        strategy: { enablePreFlightPreview: false },
        inlineContexts: [],
      } as any,
    ]);

    const sessionId = URN.parse('urn:llm:session:123');
    await service.sendMessage('Hello', sessionId);

    expect(mockMessageStorage.saveMessage).toHaveBeenCalledTimes(2);

    const userMsg = mockMessageStorage.saveMessage.mock.calls[0][0];
    const placeholderMsg = mockMessageStorage.saveMessage.mock.calls[1][0];

    const userTime = Temporal.Instant.from(userMsg.timestamp);
    const placeholderTime = Temporal.Instant.from(placeholderMsg.timestamp);

    expect(placeholderTime.epochMilliseconds).toBe(
      userTime.epochMilliseconds + 1,
    );
  });

  it('should successfully extract a clean session with valid explicit intent buckets', async () => {
    await service.extractToNewSession(['urn:llm:message:1'], 'copy');

    expect(mockSessionStorage.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        inlineContexts: [],
        systemContexts: [],
        compiledContext: undefined,
        quickContext: [],
      }),
    );
  });
});
