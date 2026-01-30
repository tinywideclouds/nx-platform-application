// libs/messenger/ui/chat/src/lib/chat-window/chat-window.component.ts

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

// Services
import { AppState } from '@nx-platform-application/messenger-state-app';
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

// Strict View State Definition
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
  private readonly appState = inject(AppState);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly logger = inject(Logger);

  // --- INPUTS (Data) ---

  // Driven by AppState (The Truth)
  readonly dataState = this.appState.pageState;
  readonly capabilities = this.appState.capabilities;
  readonly isKeyMissing = this.appState.isRecipientKeyMissing;
  readonly activeLocalGroup = this.appState.activeLocalGroup;

  // Driven by Router (The Intent)
  readonly conversationUrn = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = params.get('id');
        return id ? URN.parse(id) : null;
      }),
    ),
    { initialValue: null },
  );

  /**
   * Determines if we are showing the Conversation or the Details/Settings.
   * Derived by checking the child route.
   */
  readonly viewMode = toSignal<ChatWindowMode>(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        const child = this.route.firstChild;
        // ✅ FIX: Strict Optional Chaining to prevent "reading 'url' of undefined"
        // We check child?.snapshot?.url explicitly.
        if (child?.snapshot?.url?.[0]?.path === 'details') {
          return 'details';
        }
        return 'chat';
      }),
    ),
  );

  /**
   * Resolves the UI model for the header (Name, Avatar).
   * Finds the matching UIConversation from the AppState list.
   */
  readonly headerData = computed<HeaderParticipant | null>(() => {
    const urn = this.conversationUrn();
    const list = this.appState.uiConversations();
    if (!urn) return null;

    const match = list.find((c) => c.id.equals(urn));
    if (!match) return null;

    return {
      name: match.name,
      initials: match.initials,
      pictureUrl: match.pictureUrl,
    };
  });

  /**
   * Resolves the "Kind" of group for the Header UI (Icons/Badges).
   */
  readonly groupType = computed<HeaderGroupType>(() => {
    const caps = this.capabilities();
    if (!caps) return null;

    switch (caps.kind) {
      case 'network-group':
        return 'network';
      case 'local-group':
        return 'local';
      case 'p2p':
      default:
        return null;
    }
  });

  // --- THE UNIFIED VIEW STATE (The Gatekeeper) ---

  readonly viewState = computed<ChatWindowState>(() => {
    const dataState = this.dataState();
    const mode = this.viewMode();

    // RULE 1: Details View always wins
    if (mode === 'details') {
      return 'SHOW_ROUTER_OUTLET';
    }

    // RULE 2: Map Data State to View State
    switch (dataState) {
      case 'LOADING':
        return 'SHOW_LOADING';

      case 'BLOCKED':
        return 'SHOW_BLOCKED';

      case 'PASSIVE_CONTACT_GROUP':
        return 'SHOW_INTRO';

      case 'EMPTY_NETWORK_GROUP':
      case 'ACTIVE_CHAT':
      case 'PASSIVE_CONTACT_USER':
      case 'QUARANTINE_REQUEST':
      default:
        return 'SHOW_ROUTER_OUTLET';
    }
  });

  readonly title = computed(() => {
    return this.headerData()?.name || 'Chat';
  });

  readonly isLoading = computed(() => this.viewState() === 'SHOW_LOADING');

  constructor() {
    // 1. Focus Management (The Handshake)
    effect(() => {
      const urn = this.conversationUrn();
      untracked(() => {
        if (urn) {
          this.appState.loadConversation(urn);
        }
      });
    });

    // 2. Cleanup on Destroy
    this.destroyRef.onDestroy(() => {
      this.appState.loadConversation(null);
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
    this.logger.info('Open Broadcast Dialog (Next Step)');
  }

  // --- Intro Actions ---

  onStartBroadcast(): void {
    this.logger.info('Starting broadcast flow...');
  }

  async onCreateGroupChat(): Promise<void> {
    const urn = this.conversationUrn();
    const p = this.headerData();
    const name = p?.name || 'New Group';

    if (!urn) return;

    const memberCount = this.activeLocalGroup()?.memberUrns?.length || 0;

    const dialogRef = this.dialog.open(NetworkGroupSetupDialog, {
      width: '400px',
      data: {
        defaultName: name,
        memberCount,
      },
    });

    const resultName = await firstValueFrom(dialogRef.afterClosed());
    if (!resultName) return;

    const newGroupUrn = await this.appState.provisionNetworkGroup(
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
