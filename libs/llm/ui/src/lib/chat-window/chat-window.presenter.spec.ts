import { TestBed } from '@angular/core/testing';
import { ChatWorkspacePresenter } from './chat-window.presenter';
import { signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { URN } from '@nx-platform-application/platform-types';

import { LlmScrollSource } from '@nx-platform-application/llm-features-chat';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmChatActions } from '@nx-platform-application/llm-domain-conversation';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ChatWorkspacePresenter', () => {
  let presenter: ChatWorkspacePresenter;

  const mockScrollSource = {
    activeSessionId: signal<URN | null>(null),
    items: signal([]),
  };

  const mockSessionSource = {
    activeSessionId: signal<URN | null>(null),
    activeSession: signal<any>(null),
  };

  const mockChatActions = {
    sendMessage: vi.fn(),
    toggleExcludeSelected: vi.fn(),
    deleteSelected: vi.fn(),
  };

  const mockSessionActions = { openSession: vi.fn() };

  const mockSnackBar = {
    open: vi.fn().mockReturnValue({ onAction: () => ({ subscribe: vi.fn() }) }),
  };
  const mockDialog = {
    open: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChatWorkspacePresenter,
        { provide: LlmScrollSource, useValue: mockScrollSource },
        { provide: LlmSessionSource, useValue: mockSessionSource },
        { provide: LlmChatActions, useValue: mockChatActions },
        { provide: LlmSessionActions, useValue: mockSessionActions },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: MatDialog, useValue: mockDialog },
      ],
    });

    presenter = TestBed.inject(ChatWorkspacePresenter);
  });

  it('should toggle selection mode and clear selected ids', () => {
    presenter.selectedIds.set(new Set(['msg-1']));
    presenter.toggleSelectionMode();

    expect(presenter.isSelectionMode()).toBe(true);
    expect(presenter.selectedIds().size).toBe(0);
  });

  it('should handle sending with a tactical override and trigger turn counting', () => {
    const sessionUrn = URN.parse('urn:llm:session:123');
    mockSessionSource.activeSession.set({
      id: sessionUrn,
      llmModel: 'gemini-3.1-flash',
      strategy: { secondaryModelLimit: 1 },
    });
    mockScrollSource.activeSessionId.set(sessionUrn);

    presenter.setTacticalModel('gemini-3.1-pro');
    expect(presenter.activeModelId()).toBe('gemini-3.1-pro');

    presenter.handleSend('Hello');

    expect(mockChatActions.sendMessage).toHaveBeenCalledWith(
      'Hello',
      sessionUrn,
      'gemini-3.1-pro',
    );
    expect(mockSnackBar.open).toHaveBeenCalled(); // Since limit was 1, it hits limit immediately
  });

  it('should reset tactical overrides and focus when session changes', () => {
    presenter.setTacticalModel('gemini-3.1-pro');
    presenter.focusedGroupUrn.set('urn:tag:1');

    // Simulate session switch by triggering effect
    TestBed.flushEffects();
    mockSessionSource.activeSessionId.set(URN.parse('urn:llm:session:999'));
    TestBed.flushEffects();

    expect(presenter.temporaryModelOverride()).toBeNull();
    expect(presenter.focusedGroupUrn()).toBeNull();
  });
});
