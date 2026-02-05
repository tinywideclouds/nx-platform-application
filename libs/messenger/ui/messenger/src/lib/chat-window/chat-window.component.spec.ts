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

// ✅ NEW FACADES
import { ActiveChatFacade } from '@nx-platform-application/messenger-state-active-chat';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import {
  ChatDataService,
  UIConversation,
} from '@nx-platform-application/messenger-state-chat-data';
import { AddressBookApi } from '@nx-platform-application/contacts-api';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { Conversation } from '@nx-platform-application/messenger-types';

describe('ChatWindowComponent', () => {
  let component: ChatWindowComponent;
  let harness: RouterTestingHarness;
  let activeChatMock: any;

  // Control Signals
  const isLoadingSig = signal(false);
  const blockedSetSig = signal(new Set<string>());
  const uiConversationsSig = signal<UIConversation[]>([]);
  const selectedConversationSig = signal<Conversation | null>(null);

  beforeEach(async () => {
    // Mock Active Chat
    activeChatMock = {
      isLoading: isLoadingSig,
      selectedConversation: selectedConversationSig,
      isRecipientKeyMissing: signal(false),
      loadConversation: vi.fn(),
      provisionNetworkGroup: vi
        .fn()
        .mockResolvedValue(URN.parse('urn:messenger:group:new')),
    };

    await TestBed.configureTestingModule({
      imports: [ChatWindowComponent],
      providers: [
        provideRouter([
          {
            path: 'messenger/conversations/:id',
            component: ChatWindowComponent,
            children: [
              { path: '', component: MockComponent(ChatGroupIntroComponent) },
              {
                path: 'details',
                component: MockComponent(ChatGroupIntroComponent),
              },
            ],
          },
        ]),
        // ✅ Facades
        MockProvider(ActiveChatFacade, activeChatMock),
        MockProvider(ChatModerationFacade, { blockedSet: blockedSetSig }),
        MockProvider(ChatDataService, { uiConversations: uiConversationsSig }),
        MockProvider(AddressBookApi, {
          getGroup: vi.fn().mockResolvedValue(null),
        }),
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

  it('should load conversation from Facade on route activation', async () => {
    const urn = URN.parse('urn:messenger:group:123');
    await harness.navigateByUrl(`/messenger/conversations/${urn.toString()}`);

    expect(activeChatMock.loadConversation).toHaveBeenCalledWith(urn);
  });

  describe('View State Logic', () => {
    const urn = 'urn:messenger:group:123';

    it('should show LOADING when isLoading is true', async () => {
      isLoadingSig.set(true);
      component = await harness.navigateByUrl(
        `/messenger/conversations/${urn}`,
        ChatWindowComponent,
      );
      expect(component.viewState()).toBe('SHOW_LOADING');
    });

    it('should show BLOCKED when in blockedSet', async () => {
      blockedSetSig.set(new Set([urn]));
      component = await harness.navigateByUrl(
        `/messenger/conversations/${urn}`,
        ChatWindowComponent,
      );
      expect(component.viewState()).toBe('SHOW_BLOCKED');
    });

    it('should show INTRO for Local Contact Groups', async () => {
      const localUrn = 'urn:contacts:group:local';
      component = await harness.navigateByUrl(
        `/messenger/conversations/${localUrn}`,
        ChatWindowComponent,
      );
      expect(component.viewState()).toBe('SHOW_INTRO');
    });

    it('should show ROUTER_OUTLET for standard chats', async () => {
      component = await harness.navigateByUrl(
        `/messenger/conversations/${urn}`,
        ChatWindowComponent,
      );
      expect(component.viewState()).toBe('SHOW_ROUTER_OUTLET');
    });
  });

  describe('Header Data', () => {
    it('should resolve name/avatar from ChatDataService UI list', async () => {
      const urnStr = 'urn:contacts:user:alice';
      const urn = URN.parse(urnStr);

      uiConversationsSig.set([
        {
          id: urn,
          name: 'Alice (Alias)',
          initials: 'AL',
          pictureUrl: 'img.png',
        } as any,
      ]);

      component = await harness.navigateByUrl(
        `/messenger/conversations/${urnStr}`,
        ChatWindowComponent,
      );

      expect(component.headerData()).toEqual({
        name: 'Alice (Alias)',
        initials: 'AL',
        pictureUrl: 'img.png',
      });
    });
  });

  describe('Group Type', () => {
    it('should identify network group from URN', async () => {
      component = await harness.navigateByUrl(
        '/messenger/conversations/urn:messenger:group:1',
        ChatWindowComponent,
      );
      expect(component.groupType()).toBe('network');
    });

    it('should identify local group from URN', async () => {
      component = await harness.navigateByUrl(
        '/messenger/conversations/urn:contacts:group:1',
        ChatWindowComponent,
      );
      expect(component.groupType()).toBe('local');
    });

    it('should identify P2P (null) from user URN', async () => {
      component = await harness.navigateByUrl(
        '/messenger/conversations/urn:contacts:user:1',
        ChatWindowComponent,
      );
      expect(component.groupType()).toBeNull();
    });
  });
});
