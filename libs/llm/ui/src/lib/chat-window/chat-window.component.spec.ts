import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LlmChatWindowComponent } from './chat-window.component';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import {
  LlmChatActions,
  LlmSessionActions,
} from '@nx-platform-application/llm-domain-conversation';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmSession } from '@nx-platform-application/llm-types';

describe('LlmChatWindowComponent', () => {
  let component: LlmChatWindowComponent;
  let fixture: ComponentFixture<LlmChatWindowComponent>;
  let router: Router;

  // Mocks
  const mockScrollSource = {
    setSession: vi.fn(),
    activeSessionId: signal<URN | null>(null),
    isGenerating: signal(false),
    items: signal([]),
  };

  const mockSessionSource = {
    sessions: signal<LlmSession[]>([]),
  };

  const mockSessionActions = {
    isCompiling: vi.fn().mockReturnValue(signal(false)),
    openSession: vi.fn(),
  };

  const mockStorageService = {
    getSessions: vi.fn().mockResolvedValue([]),
  };

  const mockChatActions = {
    sendMessage: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [LlmChatWindowComponent, BrowserAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: LlmScrollSource, useValue: mockScrollSource },
        { provide: LlmSessionSource, useValue: mockSessionSource },
        { provide: LlmSessionActions, useValue: mockSessionActions },
        { provide: LlmStorageService, useValue: mockStorageService },
        { provide: LlmChatActions, useValue: mockChatActions },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(async () => true);

    fixture = TestBed.createComponent(LlmChatWindowComponent);
    component = fixture.componentInstance;
  });

  describe('Initialization & Routing', () => {
    it('should hydrate source if sessionId is provided', () => {
      fixture.componentRef.setInput('sessionId', 'urn:llm:session:123');
      fixture.detectChanges();
      expect(mockScrollSource.setSession).toHaveBeenCalled();
    });

    it('should navigate to a new session if sessionId is invalid/missing and no history exists', async () => {
      fixture.componentRef.setInput('sessionId', undefined);
      fixture.detectChanges();

      // Allow async resumeLastSession to resolve
      await new Promise(process.nextTick);

      expect(router.navigate).toHaveBeenCalledWith(
        expect.arrayContaining(['chat']),
        expect.objectContaining({ replaceUrl: true }),
      );
    });
  });

  describe('Chat Lock State (Compilation Guardrails)', () => {
    const activeSessionUrn = 'urn:llm:session:123';

    beforeEach(() => {
      fixture.componentRef.setInput('sessionId', activeSessionUrn);
    });

    it('should not lock if the session has no gemini-cache targets', () => {
      mockSessionSource.sessions.set([
        {
          id: URN.parse(activeSessionUrn),
          title: 'Test',
          lastModified: '' as ISODateTimeString,
          attachments: [
            {
              id: '1',
              cacheId: URN.parse('urn:repo:1'),
              target: 'inline-context',
            },
          ],
        },
      ]);
      fixture.detectChanges();

      expect(component.chatLockState().locked).toBe(false);
    });

    it('should lock with a warning if a gemini-cache target exists but is uncompiled (Cache Drift)', () => {
      mockSessionSource.sessions.set([
        {
          id: URN.parse(activeSessionUrn),
          title: 'Test',
          lastModified: '' as ISODateTimeString,
          geminiCache: undefined, // Missing!
          attachments: [
            {
              id: '1',
              cacheId: URN.parse('urn:repo:1'),
              target: 'gemini-cache',
            },
          ],
        },
      ]);
      fixture.detectChanges();

      expect(component.chatLockState().locked).toBe(true);
      expect(component.chatLockState().reason).toContain('Settings');
    });

    it('should lock with a spinning status if currently compiling in the background', () => {
      mockSessionSource.sessions.set([
        {
          id: URN.parse(activeSessionUrn),
          title: 'Test',
          lastModified: '' as ISODateTimeString,
          attachments: [
            {
              id: '1',
              cacheId: URN.parse('urn:repo:1'),
              target: 'gemini-cache',
            },
          ],
        },
      ]);

      // Override the mock to simulate an active compilation
      mockSessionActions.isCompiling.mockReturnValue(signal(true));
      fixture.detectChanges();

      expect(component.chatLockState().locked).toBe(true);
      expect(component.chatLockState().reason).toContain('⚙️');
    });

    it('should block sending messages when locked', () => {
      // Force a locked state via cache drift
      mockSessionSource.sessions.set([
        {
          id: URN.parse(activeSessionUrn),
          title: 'Test',
          lastModified: '' as ISODateTimeString,
          geminiCache: undefined,
          attachments: [
            {
              id: '1',
              cacheId: URN.parse('urn:repo:1'),
              target: 'gemini-cache',
            },
          ],
        },
      ]);
      mockScrollSource.activeSessionId.set(URN.parse(activeSessionUrn));
      fixture.detectChanges();

      component.onSend({ text: 'Hello AI', files: [] });

      // Should be blocked!
      expect(mockChatActions.sendMessage).not.toHaveBeenCalled();
    });
  });
});
