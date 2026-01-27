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
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

// Services
import { AppState } from '@nx-platform-application/messenger-state-app';
import { ContactsStorageService } from '@nx-platform-application/contacts-infrastructure-storage';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { ChatParticipant } from '@nx-platform-application/messenger-types';

// Components
import {
  ChatWindowHeaderComponent,
  ChatWindowMode,
  ChatScopeMode,
  ChatGroupIntroComponent,
} from '@nx-platform-application/messenger-ui-chat';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'messenger-chat-window',
  standalone: true,
  imports: [
    RouterOutlet,
    ChatWindowHeaderComponent,
    ChatGroupIntroComponent,
    MatProgressSpinnerModule,
  ],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected appState = inject(AppState);
  private contactsService = inject(ContactsStorageService);
  private logger = inject(Logger);

  // --- Router & Data State ---
  private routerEvents$ = this.router.events;
  private routeParams = toSignal(this.route.paramMap);
  private queryParams = toSignal(this.route.queryParamMap);

  // Data Loading State
  isLoading = signal(false);
  // Action State
  isUpgrading = signal(false);

  viewMode = toSignal(
    this.routerEvents$.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => {
        return this.router.url.endsWith('/details')
          ? ('details' as ChatWindowMode)
          : ('chat' as ChatWindowMode);
      }),
    ),
    { initialValue: 'chat' as ChatWindowMode },
  );

  conversationUrnString = computed(() => this.routeParams()?.get('id') || null);

  conversationUrn = computed(() => {
    const urnStr = this.conversationUrnString();
    if (!urnStr) return null;
    try {
      return URN.parse(urnStr);
    } catch (err) {
      this.logger.error('Failed to parse URN from route:', err);
      return null;
    }
  });

  isKeyMissing = this.appState.isRecipientKeyMissing;
  messages = this.appState.messages;

  private contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [],
  });
  private groups = toSignal(this.contactsService.groups$, { initialValue: [] });

  // --- Zero State Logic ---
  hasDismissedIntro = signal(false);

  activeScope = computed<ChatScopeMode | null>(() => {
    const urn = this.conversationUrn();
    if (!urn) return null;
    const param = this.queryParams()?.get('scope');
    if (param === 'local' || param === 'network') return param as ChatScopeMode;
    if (urn.entityType === 'group') {
      return urn.namespace.startsWith('messenger') ? 'network' : 'local';
    }
    return null;
  });

  isUpgradeView = computed(() => {
    const scope = this.activeScope();
    const urn = this.conversationUrn();
    return scope === 'network' && urn?.namespace.startsWith('contacts');
  });

  isEmptyBroadcast = computed(() => {
    const scope = this.activeScope();
    const msgs = this.messages();
    const dismissed = this.hasDismissedIntro();
    // Logic: Only consider it "Empty" if we are NOT loading.
    // This prevents the check from firing while the fetch is in progress.
    return (
      !this.isLoading() && scope === 'local' && msgs.length === 0 && !dismissed
    );
  });

  participant = computed<ChatParticipant | null>(() => {
    const urn = this.conversationUrn();
    if (!urn) return null;

    if (urn.entityType === 'user') {
      const contact = this.contacts().find((c) => c.id.equals(urn));
      if (!contact) return { urn, name: 'Unknown User', initials: '?' };
      return {
        urn,
        name: contact.alias,
        initials: (contact.firstName?.[0] || '') + (contact.surname?.[0] || ''),
        profilePictureUrl:
          contact.serviceContacts['messenger']?.profilePictureUrl,
      };
    }

    if (urn.entityType === 'group') {
      const group = this.groups().find(
        (g) => g.id.toString() === urn.toString(),
      );
      if (!group) return { urn, name: 'Unknown Group', initials: 'G' };
      return { urn, name: group.name, initials: 'G' };
    }
    return null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.appState.loadConversation(null);
    });

    // Reset local UI state when conversation changes
    effect(() => {
      this.conversationUrn();
      untracked(() => this.hasDismissedIntro.set(false));
    });

    // Data Loader Effect
    effect(() => {
      const urn = this.conversationUrn();
      if (urn) {
        untracked(async () => {
          this.isLoading.set(true); // 1. Start Loading
          try {
            await this.appState.loadConversation(urn); // 2. Wait for data
          } catch (e) {
            this.logger.error('Failed to load conversation', e);
          } finally {
            this.isLoading.set(false); // 3. Resolve
          }
        });
      }
    });
  }

  // --- Actions ---

  onHeaderBack(): void {
    if (this.viewMode() === 'details') {
      this.router.navigate(['./'], {
        relativeTo: this.route,
        queryParamsHandling: 'merge',
      });
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

  async onScopeChange(newMode: ChatScopeMode): Promise<void> {
    const currentUrn = this.conversationUrn();
    if (!currentUrn) return;

    if (newMode === 'network') {
      const children = await this.contactsService.getGroupsByParent(currentUrn);
      if (children.length > 0) {
        this.router.navigate([
          '/messenger',
          'conversations',
          children[0].id.toString(),
        ]);
      } else {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { scope: 'network' },
          queryParamsHandling: 'merge',
        });
      }
    } else {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { scope: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  onStartBroadcast(): void {
    if (this.isUpgradeView()) {
      this.onScopeChange('local');
    }
    this.hasDismissedIntro.set(true);
  }

  async onCreateGroupChat(): Promise<void> {
    const currentUrn = this.conversationUrn();
    if (!currentUrn) return;

    // 1. Set Loading State (Minting keys + saving contacts takes ~200ms)
    this.isUpgrading.set(true);

    try {
      // 2. Perform Upgrade via State Layer
      const newGroupUrn = await this.appState.provisionNetworkGroup(currentUrn);

      if (newGroupUrn) {
        // 3. Navigation: Switch to the new Network Group
        // We use replaceUrl to avoid going "Back" to the setup screen
        await this.router.navigate(
          ['/messenger', 'conversations', newGroupUrn.toString()],
          { replaceUrl: true },
        );
      }
    } catch (error) {
      this.logger.error('Failed to create group chat', error);
      // Optional: Add snackbar here if desired
    } finally {
      this.isUpgrading.set(false);
    }
  }
}
