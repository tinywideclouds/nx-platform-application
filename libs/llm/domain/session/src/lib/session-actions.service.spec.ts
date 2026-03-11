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
    lastModified: '2026-03-01T10:00:00Z' as ISODateTimeString,
    inlineContexts: [
      {
        id: URN.parse('urn:llm:attachment:1256'),
        resourceUrn: URN.parse('urn:data-source:repo:123'),
        resourceType: 'source',
      },
    ],
    systemContexts: [],
    compiledContext: undefined,
    quickContext: [],
  };

  describe('Session Lifecycle', () => {
    it('should create a new session with empty intent buckets and navigate to it', async () => {
      await service.createNewSession('New Chat', 'chat', 'gemini-1.5-pro');

      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Chat',
          llmModel: 'gemini-1.5-pro',
          inlineContexts: [],
          systemContexts: [],
          compiledContext: undefined,
          quickContext: [],
        }),
      );
      expect(mockSource.refresh).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/chat',
        expect.any(String),
      ]);
    });

    it('should create a new session and navigate to details if options target is requested', async () => {
      await service.createNewSession(
        'Settings Chat',
        'options',
        'gemini-2.5-pro',
      );

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/chat', expect.any(String)],
        { queryParams: { view: 'details' } },
      );
    });

    it('should open an existing session', async () => {
      const targetUrn = URN.parse('urn:llm:session:999');
      await service.openSession(targetUrn);
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/chat',
        'urn:llm:session:999',
      ]);
    });

    it('should update a session and refresh the source', async () => {
      await service.updateSession(mockSession);
      expect(mockStorage.saveSession).toHaveBeenCalledWith(mockSession);
      expect(mockSource.refresh).toHaveBeenCalled();
    });

    it('should delete a session and refresh the source', async () => {
      await service.deleteSession(mockSession.id);
      expect(mockStorage.deleteSession).toHaveBeenCalledWith(mockSession.id);
      expect(mockSource.refresh).toHaveBeenCalled();
    });

    it('should safely set the workspace target', async () => {
      const targetId = URN.parse('urn:data-source:repo:abc');
      mockStorage.getSession.mockResolvedValue(mockSession);

      await service.setWorkspaceTarget(mockSession.id, targetId);

      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceTarget: targetId }),
      );
      expect(mockSource.refresh).toHaveBeenCalled();
    });
  });

  describe('Context Intent Management', () => {
    it('should append a new attachment pointer to an array bucket', async () => {
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
      expect(mockSource.refresh).toHaveBeenCalled();
    });

    it('should directly assign an attachment pointer to the singleton compiledContext bucket', async () => {
      mockStorage.getSession.mockResolvedValue(mockSession);
      const blueprintUrn = URN.parse('urn:data-source:group:blueprint-1');

      await service.attachContext(
        mockSession.id,
        blueprintUrn,
        'group',
        'compiledContext',
      );

      const saveCallArgs = mockStorage.saveSession.mock.calls[0][0];
      expect(saveCallArgs.compiledContext).toBeDefined();
      expect(saveCallArgs.compiledContext.resourceUrn.toString()).toBe(
        'urn:data-source:group:blueprint-1',
      );
      expect(saveCallArgs.compiledContext.resourceType).toBe('group');
    });

    it('should remove an attachment pointer from an array bucket', async () => {
      mockStorage.getSession.mockResolvedValue(mockSession);
      const targetId = URN.parse('urn:llm:attachment:1256');

      await service.removeContext(mockSession.id, targetId, 'inlineContexts');

      const saveCallArgs = mockStorage.saveSession.mock.calls[0][0];
      expect(saveCallArgs.inlineContexts).toHaveLength(0);
      expect(mockSource.refresh).toHaveBeenCalled();
    });

    it('should clear the singleton compiledContext bucket', async () => {
      const activeCompiledSession = {
        ...mockSession,
        compiledContext: {
          id: URN.parse('urn:llm:attachment:comp1'),
          resourceUrn: URN.parse('urn:data-source:group:blueprint-1'),
          resourceType: 'group' as const,
        },
      };
      mockStorage.getSession.mockResolvedValue(activeCompiledSession);

      const targetId = URN.parse('urn:llm:attachment:comp1');
      await service.removeContext(mockSession.id, targetId, 'compiledContext');

      const saveCallArgs = mockStorage.saveSession.mock.calls[0][0];
      expect(saveCallArgs.compiledContext).toBeUndefined();
    });
  });

  describe('Quick Context Window', () => {
    it('should add a quick file to the front of the array and return undefined if nothing dropped', async () => {
      mockStorage.getSession.mockResolvedValue(mockSession);
      const dropped = await service.addQuickFile(mockSession.id, {
        name: 'test.ts',
        content: 'code',
      });

      expect(dropped).toBeUndefined();
      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          quickContext: [
            expect.objectContaining({ name: 'test.ts', content: 'code' }),
          ],
        }),
      );
      expect(mockSource.refresh).toHaveBeenCalled();
    });

    it('should deduplicate files with the same name, moving it to the front', async () => {
      mockStorage.getSession.mockResolvedValue({
        ...mockSession,
        quickContext: [
          {
            id: URN.parse('urn:llm:quick:old'),
            name: 'test.ts',
            content: 'old code',
          },
          {
            id: URN.parse('urn:llm:quick:other'),
            name: 'other.ts',
            content: 'other code',
          },
        ],
      });

      const dropped = await service.addQuickFile(mockSession.id, {
        name: 'test.ts',
        content: 'new code',
      });

      expect(dropped).toBeUndefined();
      const saveCallArgs = mockStorage.saveSession.mock.calls[0][0];
      expect(saveCallArgs.quickContext).toHaveLength(2);
      expect(saveCallArgs.quickContext[0].name).toBe('test.ts');
      expect(saveCallArgs.quickContext[0].content).toBe('new code');
      expect(saveCallArgs.quickContext[1].name).toBe('other.ts');
    });

    it('should enforce a maximum window of 6 files, dropping the oldest and returning it', async () => {
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
        name: 'file7.ts',
        content: 'new',
      });

      const saveCallArgs = mockStorage.saveSession.mock.calls[0][0];

      expect(saveCallArgs.quickContext).toHaveLength(6);
      expect(saveCallArgs.quickContext[0].name).toBe('file7.ts');

      expect(saveCallArgs.quickContext[5].name).toBe('file4.ts');
      expect(
        saveCallArgs.quickContext.some((f: any) => f.name === 'file5.ts'),
      ).toBe(false);

      expect(dropped).toBeDefined();
      expect(dropped?.name).toBe('file5.ts');
    });

    it('should safely remove a file by URN', async () => {
      const targetUrn = URN.parse('urn:llm:quick:target');
      mockStorage.getSession.mockResolvedValue({
        ...mockSession,
        quickContext: [
          { id: targetUrn, name: 'delete.ts', content: 'code' },
          {
            id: URN.parse('urn:llm:quick:keep'),
            name: 'keep.ts',
            content: 'code',
          },
        ],
      });

      await service.removeQuickFile(mockSession.id, targetUrn);

      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          quickContext: [expect.objectContaining({ name: 'keep.ts' })],
        }),
      );
    });
  });
});
