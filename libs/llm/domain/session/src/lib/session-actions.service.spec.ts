import { TestBed } from '@angular/core/testing';
import { LlmSessionActions } from './session-actions.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LlmSession } from '@nx-platform-application/llm-types';

describe('LlmSessionActions', () => {
  let service: LlmSessionActions;

  const mockNetwork = {
    buildCache: vi.fn(),
  };
  const mockSnackBar = { open: vi.fn() };
  const mockLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
  const mockRouter = { navigate: vi.fn() };
  const mockStorage = {
    saveSession: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn(),
  };
  const mockSource = { refresh: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        LlmSessionActions,
        { provide: LLM_NETWORK_CLIENT, useValue: mockNetwork },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Logger, useValue: mockLogger },
        { provide: Router, useValue: mockRouter },
        { provide: LlmStorageService, useValue: mockStorage },
        { provide: LlmSessionSource, useValue: mockSource },
      ],
    });

    service = TestBed.inject(LlmSessionActions);
  });

  const mockSession: LlmSession = {
    id: URN.parse('urn:llm:session:123'),
    title: 'Test Session',
    lastModified: '2026-03-01T10:00:00Z' as ISODateTimeString,
    attachments: [
      {
        id: URN.parse('urn:llm:cache_id:1256'),
        cacheId: URN.parse('urn:firestore:repo:123'),
        target: 'compiled-cache',
      },
    ],
  };

  describe('Session Lifecycle', () => {
    it('should create a new session', async () => {
      const newId = await service.createNewSession(
        'New Chat',
        'chat',
        'gemini-1.5-pro',
      );

      expect(newId).toBeInstanceOf(URN);
      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Chat',
          llmModel: 'gemini-1.5-pro',
        }),
      );
      expect(mockSource.refresh).toHaveBeenCalled();
    });

    it('should navigate to open a session', async () => {
      await service.openSession(mockSession.id);
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/chat',
        'urn:llm:session:123',
      ]);
    });
  });

  describe('Cache Compilation', () => {
    it('should successfully compile a cache and update the session', async () => {
      mockNetwork.buildCache.mockResolvedValue({
        geminiCacheId: 'cachedContents/999',
        expiresAt: '2026-03-05T18:00:00Z',
      });

      await service.compileSessionCache(mockSession);

      expect(mockNetwork.buildCache).toHaveBeenCalledWith({
        sessionId: 'urn:llm:session:123',
        model: 'gemini-2.5-pro',
        attachments: [
          { id: 'att-1', cacheId: 'urn:repo:123', profileId: undefined },
        ],
        expiresAtHint: expect.any(String),
      });

      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockSession.id,
          compiledCache: expect.objectContaining({
            id: 'cachedContents/999',
            expiresAt: '2026-03-05T18:00:00Z',
            attachmentsUsed: expect.arrayContaining([
              expect.objectContaining({ cacheId: 'urn:repo:123' }),
            ]),
          }),
        }),
      );

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Context compiled successfully!',
        'Close',
        { duration: 3000 },
      );
    });
  });

  describe('Workspace Targeting', () => {
    it('should set and save the workspace target', async () => {
      mockStorage.getSession.mockResolvedValue(mockSession);
      const targetUrn = URN.parse('urn:repo:999');

      await service.setWorkspaceTarget(mockSession.id, targetUrn);

      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceTarget: targetUrn,
        }),
      );
      expect(mockSource.refresh).toHaveBeenCalled();
    });
  });
});
