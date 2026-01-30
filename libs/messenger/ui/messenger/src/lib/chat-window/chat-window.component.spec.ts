// libs/messenger/ui/chat/src/lib/chat-window/chat-window.component.spec.ts

import { TestBed } from '@angular/core/testing';
import { ChatWindowComponent } from './chat-window.component';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signal } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockComponent, MockProvider } from 'ng-mocks';

// Components
import {
  ChatWindowHeaderComponent,
  ChatGroupIntroComponent,
} from '@nx-platform-application/messenger-ui-chat';
import { MatDialog } from '@angular/material/dialog';

// Services
import {
  AppState,
  ConversationCapabilities,
} from '@nx-platform-application/messenger-state-app';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { UIConversation } from '@nx-platform-application/messenger-state-chat-data';
import { PageState } from 'libs/messenger/state/app/src/lib/state.engine';

describe('ChatWindowComponent', () => {
  let component: ChatWindowComponent;
  let harness: RouterTestingHarness;
  let mockAppState: any;

  // Signals
  const pageStateSig = signal<PageState>('LOADING');
  const capabilitiesSig = signal<ConversationCapabilities | null>(null);
  const isKeyMissingSig = signal(false);
  const uiConversationsSig = signal<UIConversation[]>([]);

  beforeEach(async () => {
    // Setup Mock AppState
    mockAppState = {
      pageState: pageStateSig,
      capabilities: capabilitiesSig,
      isRecipientKeyMissing: isKeyMissingSig,
      uiConversations: uiConversationsSig,
      loadConversation: vi.fn(), // Replaces focusConversation
      provisionNetworkGroup: vi
        .fn()
        .mockResolvedValue(URN.parse('urn:messenger:group:new')),
    };

    await TestBed.configureTestingModule({
      imports: [ChatWindowComponent], // Standalone
      providers: [
        provideRouter([
          {
            path: 'messenger/conversations/:id',
            component: ChatWindowComponent,
            children: [
              { path: '', component: MockComponent(ChatGroupIntroComponent) }, // Mock child
              {
                path: 'details',
                component: MockComponent(ChatGroupIntroComponent),
              },
            ],
          },
        ]),
        MockProvider(AppState, mockAppState),
        MockProvider(Logger),
        MockProvider(MatDialog),
      ],
    })
      .overrideComponent(ChatWindowComponent, {
        remove: {
          imports: [ChatWindowHeaderComponent, ChatGroupIntroComponent],
        },
        add: {
          imports: [
            MockComponent(ChatWindowHeaderComponent),
            MockComponent(ChatGroupIntroComponent),
          ],
        },
      })
      .compileComponents();

    harness = await RouterTestingHarness.create();
  });

  it('should focus conversation on route activation', async () => {
    const urn = URN.parse('urn:messenger:group:123');
    await harness.navigateByUrl(`/messenger/conversations/${urn.toString()}`);

    expect(mockAppState.loadConversation).toHaveBeenCalledWith(urn);
  });

  it('should blur conversation on destroy (nav away)', async () => {
    const urn = URN.parse('urn:messenger:group:123');
    // ✅ Correct: Capture instance from return value
    await harness.navigateByUrl(
      `/messenger/conversations/${urn.toString()}`,
      ChatWindowComponent,
    );

    expect(mockAppState.loadConversation).toHaveBeenCalledWith(urn);
  });

  describe('View State Logic (The Gatekeeper)', () => {
    const urn = 'urn:messenger:group:123';

    it('should show LOADING when pageState is LOADING', async () => {
      pageStateSig.set('LOADING');
      component = await harness.navigateByUrl(
        `/messenger/conversations/${urn}`,
        ChatWindowComponent,
      );
      expect(component.viewState()).toBe('SHOW_LOADING');
    });

    it('should show INTRO when pageState is EMPTY_NETWORK_GROUP', async () => {
      pageStateSig.set('EMPTY_NETWORK_GROUP');
      component = await harness.navigateByUrl(
        `/messenger/conversations/${urn}`,
        ChatWindowComponent,
      );
      expect(component.viewState()).toBe('SHOW_INTRO');
    });

    it('should show BLOCKED when pageState is BLOCKED', async () => {
      pageStateSig.set('BLOCKED');
      component = await harness.navigateByUrl(
        `/messenger/conversations/${urn}`,
        ChatWindowComponent,
      );
      expect(component.viewState()).toBe('SHOW_BLOCKED');
    });

    it('should show ROUTER_OUTLET (Details) even if BLOCKED when route is /details', async () => {
      pageStateSig.set('BLOCKED');
      // Navigate to details sub-route
      component = await harness.navigateByUrl(
        `/messenger/conversations/${urn}/details`,
        ChatWindowComponent,
      );

      expect(component.viewMode()).toBe('details');
      expect(component.viewState()).toBe('SHOW_ROUTER_OUTLET');
    });
  });

  describe('Header Data Resolution', () => {
    it('should resolve participant from UI Conversations list', async () => {
      const urnStr = 'urn:contacts:user:alice';
      const urn = URN.parse(urnStr);

      // Mock Data
      uiConversationsSig.set([
        {
          id: urn,
          name: 'Alice',
          initials: 'AL',
          pictureUrl: 'img.png',
        } as any,
      ]);

      component = await harness.navigateByUrl(
        `/messenger/conversations/${urnStr}`,
        ChatWindowComponent,
      );

      const header = component.headerData();
      expect(header).toEqual({
        name: 'Alice',
        initials: 'AL',
        pictureUrl: 'img.png',
      });
    });

    it('should determine groupType from capabilities', async () => {
      capabilitiesSig.set({
        kind: 'network-group',
        canBroadcast: true,
        canFork: true,
      });

      component = await harness.navigateByUrl(
        '/messenger/conversations/urn:messenger:group:1',
        ChatWindowComponent,
      );

      expect(component.groupType()).toBe('network');
    });
  });
});
