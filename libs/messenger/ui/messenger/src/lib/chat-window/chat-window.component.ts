import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  computed,
  effect,
  untracked,
  signal,
} from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterOutlet,
  NavigationEnd,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// ✅ STATE LAYERS (Decoupled)
import { ActiveChatFacade } from '@nx-platform-application/messenger-state-active-chat';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';

// ✅ APIs (For Local Group Data)
import { AddressBookApi } from '@nx-platform-application/contacts-api';
import { ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// Components
import {
  ChatWindowHeaderComponent,
  ChatGroupIntroComponent,
  NetworkGroupSetupDialog,
  ChatWindowMode,
  HeaderGroupType,
  HeaderParticipant,
} from '@nx-platform-application/messenger-ui-chat';

export type ChatWindowState =
  | 'SHOW_LOADING'
  | 'SHOW_BLOCKED'
  | 'SHOW_INTRO'
  | 'SHOW_ROUTER_OUTLET';

@Component({
  selector: 'messenger-chat-window',
  standalone: true,
  imports: [
    RouterOutlet,
    ChatWindowHeaderComponent,
    ChatGroupIntroComponent,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly logger = inject(Logger);

  // ✅ INJECTED STATE
  private readonly activeChat = inject(ActiveChatFacade);
  private readonly moderation = inject(ChatModerationFacade);
  private readonly chatData = inject(ChatDataService);
  private readonly addressBookApi = inject(AddressBookApi);

  // --- STATE SIGNALS ---

  // 1. From Active Chat
  readonly isLoading = this.activeChat.isLoading;
  readonly isKeyMissing = this.activeChat.isRecipientKeyMissing;
  readonly selectedConversation = this.activeChat.selectedConversation;

  // 2. From Moderation
  readonly blockedSet = this.moderation.blockedSet;

  // 3. Local Group Cache (Replaces AppState.activeLocalGroup)
  private readonly _localGroupCache = signal<ContactGroup | null>(null);
  readonly activeLocalGroup = this._localGroupCache.asReadonly();

  // --- ROUTER LOGIC (The Driver) ---

  // 1. URL ID Source
  readonly conversationUrn = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = params.get('id');
        return id ? URN.parse(id) : null;
      }),
    ),
    { initialValue: null },
  );

  // 2. View Mode (Chat vs Details)
  readonly viewMode = toSignal<ChatWindowMode>(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        const child = this.route.firstChild;
        // Check if we are in the details sub-route
        if (child?.snapshot?.url?.[0]?.path === 'details') {
          return 'details';
        }
        return 'chat';
      }),
    ),
    { initialValue: undefined },
  );

  // --- COMPUTED VIEW STATE ---

  /**
   * ✅ Header Data Resolution
   * Looks up the FULL rich conversation from ChatDataService to get proper Avatar/Initials.
   */
  readonly headerData = computed<HeaderParticipant | null>(() => {
    const urn = this.conversationUrn();
    // We access the UI list to get the "Sauce" (Alias/Avatar)
    const list = this.chatData.uiConversations();

    if (!urn) return null;

    const match = list.find((c) => c.id.equals(urn));

    // Fallback to selectedConversation if not in list yet (rare race condition)
    if (!match) {
      const raw = this.selectedConversation();
      if (raw && raw.id.equals(urn)) {
        return {
          name: raw.name || 'Unknown',
          initials: '?',
          pictureUrl: undefined,
        };
      }
      return null;
    }

    return {
      name: match.name,
      initials: match.initials,
      pictureUrl: match.pictureUrl,
    };
  });

  readonly title = computed(() => this.headerData()?.name || 'Chat');

  /**
   * ✅ Group Type Logic
   * Derived purely from URN structure. Robust and simple.
   */
  readonly groupType = computed<HeaderGroupType>(() => {
    const urn = this.conversationUrn();
    if (!urn) return null;

    if (urn.namespace === 'messenger' && urn.entityType === 'group') {
      return 'network';
    }
    if (urn.namespace === 'contacts' && urn.entityType === 'group') {
      return 'local';
    }
    return null; // P2P
  });

  /**
   * ✅ The Gatekeeper (View State)
   * Replaces StateEngine logic with explicit checks.
   */
  readonly viewState = computed<ChatWindowState>(() => {
    const urn = this.conversationUrn();
    const loading = this.isLoading();
    const mode = this.viewMode();
    const blocked = this.blockedSet();

    // 1. Details wins (always show outlet)
    if (mode === 'details') return 'SHOW_ROUTER_OUTLET';

    // 2. Loading
    if (loading || !urn) return 'SHOW_LOADING';

    // 3. Blocked
    if (blocked.has(urn.toString())) return 'SHOW_BLOCKED';

    // 4. Intro (Local Group)
    if (urn.namespace === 'contacts' && urn.entityType === 'group') {
      return 'SHOW_INTRO';
    }

    // 5. Default Chat
    return 'SHOW_ROUTER_OUTLET';
  });

  constructor() {
    // 1. Bridge Router -> Active Chat
    effect(() => {
      const urn = this.conversationUrn();
      // Use untracked to prevent loops
      untracked(() => {
        if (urn) {
          this.activeChat.loadConversation(urn);
        }
      });
    });

    // 2. Fetch Local Group Details (Side Effect)
    effect(() => {
      const urn = this.conversationUrn();
      if (urn?.namespace === 'contacts' && urn.entityType === 'group') {
        this.addressBookApi.getGroup(urn).then((g) => {
          this._localGroupCache.set(g || null);
        });
      } else {
        this._localGroupCache.set(null);
      }
    });

    // 3. Cleanup
    this.destroyRef.onDestroy(() => {
      this.activeChat.loadConversation(null);
    });
  }

  // --- ACTIONS ---

  onHeaderBack(): void {
    if (this.viewMode() === 'details') {
      this.router.navigate(['../'], { relativeTo: this.route });
    } else {
      this.router.navigate(['/messenger']);
    }
  }

  onToggleInfo(): void {
    const target = this.viewMode() === 'chat' ? 'details' : './';
    this.router.navigate([target], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
    });
  }

  onHeaderFork(): void {
    this.onCreateGroupChat();
  }

  onHeaderBroadcast(): void {
    this.logger.info('Broadcast feature pending');
  }

  onStartBroadcast(): void {
    this.logger.info('Broadcast flow pending');
  }

  async onCreateGroupChat(): Promise<void> {
    const urn = this.conversationUrn();
    const p = this.headerData();
    const name = p?.name || 'New Group';

    if (!urn) return;

    const memberCount = this.activeLocalGroup()?.memberUrns?.length || 0;

    const dialogRef = this.dialog.open(NetworkGroupSetupDialog, {
      width: '400px',
      data: { defaultName: name, memberCount },
    });

    const resultName = await firstValueFrom(dialogRef.afterClosed());
    if (!resultName) return;

    // ✅ Delegation to ActiveChatFacade
    const newGroupUrn = await this.activeChat.provisionNetworkGroup(
      urn,
      resultName,
    );

    if (newGroupUrn) {
      await this.router.navigate(
        ['/messenger', 'conversations', newGroupUrn.toString()],
        { replaceUrl: true },
      );
    }
  }
}
