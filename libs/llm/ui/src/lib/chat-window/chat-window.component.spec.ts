import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmChatWindowComponent } from './chat-window.component';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import {
  LlmChatActions,
  LlmSessionActions,
} from '@nx-platform-application/llm-domain-conversation';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmSession } from '@nx-platform-application/llm-types';

describe('LlmChatWindowComponent', () => {
  let component: LlmChatWindowComponent;
  let fixture: ComponentFixture<LlmChatWindowComponent>;
  let snackBar: MatSnackBar;

  const mockScrollSource = {
    setSession: vi.fn(),
    activeSessionId: signal<URN | null>(null),
    isGenerating: signal(false),
    items: signal([]),
  };

  const mockSessionSource = {
    activeSessionId: signal<URN | null>(null),
    activeSession: signal<LlmSession | null>(null),
  };

  const mockChatActions = { sendMessage: vi.fn() };
  const mockCacheService = {
    isCompiling: signal(false),
    activeCaches: signal([]),
  };
  const mockSnackBar = {
    open: vi.fn().mockReturnValue({ onAction: () => ({ subscribe: vi.fn() }) }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmChatWindowComponent, BrowserAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: LlmScrollSource, useValue: mockScrollSource },
        { provide: LlmSessionSource, useValue: mockSessionSource },
        { provide: LlmChatActions, useValue: mockChatActions },
        { provide: CompiledCacheService, useValue: mockCacheService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmChatWindowComponent);
    component = fixture.componentInstance;
    snackBar = TestBed.inject(MatSnackBar);
  });

  describe('Tactical Overrides', () => {
    it('should set a tactical model override and use it for sending', () => {
      const sessionUrn = URN.parse('urn:llm:session:123');
      mockSessionSource.activeSession.set({
        id: sessionUrn,
        llmModel: 'gemini-3-flash-preview',
        strategy: {
          secondaryModel: 'gemini-3.1-pro-preview',
          secondaryModelLimit: 1,
        },
      } as any);
      mockScrollSource.activeSessionId.set(sessionUrn);

      component.setTacticalModel('gemini-3.1-pro-preview');
      expect(component.activeModelId()).toBe('gemini-3.1-pro-preview');

      component.onSend({ text: 'Hello' } as any);
      expect(mockChatActions.sendMessage).toHaveBeenCalledWith(
        'Hello',
        sessionUrn,
        'gemini-3.1-pro-preview',
      );
    });

    it('should trigger snackbar when prompt limit is reached', () => {
      const sessionUrn = URN.parse('urn:llm:session:123');
      mockSessionSource.activeSession.set({
        id: sessionUrn,
        llmModel: 'gemini-3-flash-preview',
        strategy: {
          secondaryModel: 'gemini-3.1-pro-preview',
          secondaryModelLimit: 1,
        },
      } as any);
      mockScrollSource.activeSessionId.set(sessionUrn);

      component.setTacticalModel('gemini-3.1-pro-preview');
      component.onSend({ text: 'Hello' } as any);

      expect(mockSnackBar.open).toHaveBeenCalled();
    });
  });
});
