import { TestBed } from '@angular/core/testing';
import { LlmSessionActions } from './session-actions.service';
import { Router } from '@angular/router';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { SessionStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LlmSession } from '@nx-platform-application/llm-types';

describe('LlmSessionActions', () => {
  let service: LlmSessionActions;

  const mockLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
  const mockRouter = { navigate: vi.fn() };
  const mockStorage = {
    saveSession: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn(),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  };
  const mockSource = { refresh: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        LlmSessionActions,
        { provide: Logger, useValue: mockLogger },
        { provide: Router, useValue: mockRouter },
        { provide: SessionStorageService, useValue: mockStorage },
        { provide: LlmSessionSource, useValue: mockSource },
      ],
    });

    service = TestBed.inject(LlmSessionActions);
  });

  const mockSession: LlmSession = {
    id: URN.parse('urn:llm:session:123'),
    title: 'Test Session',
    llmModel: 'gemini-3-flash-preview',
    lastModified: '2026-03-01T10:00:00Z' as ISODateTimeString,
    strategy: {
      primaryModel: 'gemini-3-flash-preview',
      secondaryModel: 'gemini-3.1-pro-preview',
      secondaryModelLimit: 3,
      fallbackStrategy: 'inline',
      useCacheIfAvailable: true,
    },
    inlineContexts: [
      {
        id: URN.parse('urn:llm:attachment:1256'),
        resourceUrn: URN.parse('urn:data-source:repo:123'),
        resourceType: 'source',
      },
    ],
    systemContexts: [],
    quickContext: [],
    compiledContext: undefined,
  };

  describe('Session Lifecycle & Strategy', () => {
    it('should create a new session with full -preview model names and strategy', async () => {
      await service.createNewSession(
        'New Chat',
        'chat',
        'gemini-3-flash-preview',
      );

      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Chat',
          llmModel: 'gemini-3-flash-preview',
          strategy: expect.objectContaining({
            primaryModel: 'gemini-3-flash-preview',
            secondaryModel: 'gemini-3.1-pro-preview',
            fallbackStrategy: 'inline',
          }),
        }),
      );
      expect(mockSource.refresh).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/chat',
        expect.any(String),
      ]);
    });

    it('should inject a default strategy when updating a session that lacks one', async () => {
      const legacySession = {
        id: URN.parse('urn:llm:session:legacy'),
        title: 'Legacy',
        llmModel: 'gemini-3-flash-preview',
        lastModified: '2025-01-01T00:00:00Z' as ISODateTimeString,
      } as LlmSession;

      await service.updateSession(legacySession);

      const saved = mockStorage.saveSession.mock.calls[0][0];
      expect(saved.strategy).toBeDefined();
      expect(saved.strategy.primaryModel).toBe('gemini-3-flash-preview');
    });

    it('should delete a session and refresh the source', async () => {
      await service.deleteSession(mockSession.id);
      expect(mockStorage.deleteSession).toHaveBeenCalledWith(mockSession.id);
      expect(mockSource.refresh).toHaveBeenCalled();
    });
  });

  describe('Context Intent Management', () => {
    it('should append a new attachment pointer and trigger updateSession logic', async () => {
      mockStorage.getSession.mockResolvedValue(mockSession);
      const resourceUrn = URN.parse('urn:data-source:repo:456');

      await service.attachContext(
        mockSession.id,
        resourceUrn,
        'source',
        'inlineContexts',
      );

      const saveCallArgs = mockStorage.saveSession.mock.calls[0][0];
      expect(saveCallArgs.inlineContexts).toHaveLength(2);
      expect(saveCallArgs.inlineContexts[1].resourceUrn.toString()).toBe(
        'urn:data-source:repo:456',
      );
    });

    it('should remove an attachment pointer and trigger updateSession logic', async () => {
      mockStorage.getSession.mockResolvedValue(mockSession);
      const targetId = URN.parse('urn:llm:attachment:1256');

      await service.removeContext(mockSession.id, targetId, 'inlineContexts');

      const saveCallArgs = mockStorage.saveSession.mock.calls[0][0];
      expect(saveCallArgs.inlineContexts).toHaveLength(0);
    });
  });

  describe('Quick Context Window', () => {
    it('should enforce a 6-file limit and return the dropped file', async () => {
      const fullContext = Array.from({ length: 6 }).map((_, i) => ({
        id: URN.parse(`urn:llm:quick:f${i}`),
        name: `file${i}.ts`,
        content: 'code',
      }));

      mockStorage.getSession.mockResolvedValue({
        ...mockSession,
        quickContext: fullContext,
      });

      const dropped = await service.addQuickFile(mockSession.id, {
        name: 'new-file.ts',
        content: 'new',
      });

      const saveCallArgs = mockStorage.saveSession.mock.calls[0][0];
      expect(saveCallArgs.quickContext).toHaveLength(6);
      expect(saveCallArgs.quickContext[0].name).toBe('new-file.ts');
      expect(dropped?.name).toBe('file5.ts');
    });

    it('should safely remove a file by URN', async () => {
      const targetUrn = URN.parse('urn:llm:quick:target');
      mockStorage.getSession.mockResolvedValue({
        ...mockSession,
        quickContext: [{ id: targetUrn, name: 'delete.ts', content: 'code' }],
      });

      await service.removeQuickFile(mockSession.id, targetUrn);

      const saveCallArgs = mockStorage.saveSession.mock.calls[0][0];
      expect(saveCallArgs.quickContext).toHaveLength(0);
    });
  });
});
