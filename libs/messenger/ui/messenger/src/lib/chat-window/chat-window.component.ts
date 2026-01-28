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
import { filter, map } from 'rxjs/operators';
import { MatDialog, MatDialogModule } from '@angular/material/dialog'; // ✅ Added

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
  NetworkGroupSetupDialog,
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
    MatDialogModule, // ✅ Added
  ],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog); // ✅ Added
  protected appState = inject(AppState);
  private contactsService = inject(ContactsStorageService);
  private logger = inject(Logger);

  // ... (Existing router/signal code remains the same) ...
  private routerEvents$ = this.router.events;
  private routeParams = toSignal(this.route.paramMap);
  private queryParams = toSignal(this.route.queryParamMap);
  isLoading = signal(false);
  isUpgrading = signal(false);
  hasDismissedIntro = signal(false);

  viewMode = toSignal(
    this.routerEvents$.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() =>
        this.router.url.endsWith('/details')
          ? ('details' as ChatWindowMode)
          : ('chat' as ChatWindowMode),
      ),
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

  // ... (Existing Helpers for Scope/Intro) ...

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
    // Conceptually, if we are 'network' scope but using a 'contacts' URN, we are in the Setup Phase
    return scope === 'network' && urn?.namespace.startsWith('contacts');
  });

  isEmptyBroadcast = computed(() => {
    const scope = this.activeScope();
    const msgs = this.messages();
    const dismissed = this.hasDismissedIntro();
    return (
      !this.isLoading() && scope === 'local' && msgs.length === 0 && !dismissed
    );
  });

  participant = computed<ChatParticipant | null>(() => {
    // ... (Existing logic same as provided file) ...
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

    effect(() => {
      this.conversationUrn();
      untracked(() => this.hasDismissedIntro.set(false));
    });

    effect(() => {
      const urn = this.conversationUrn();
      if (urn) {
        untracked(async () => {
          this.isLoading.set(true);
          try {
            await this.appState.loadConversation(urn);
          } catch (e) {
            this.logger.error('Failed to load conversation', e);
          } finally {
            this.isLoading.set(false);
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

  // ... (onScopeChange remains same) ...
  async onScopeChange(newMode: ChatScopeMode): Promise<void> {
    const currentUrn = this.conversationUrn();
    if (!currentUrn) return;

    if (newMode === 'network') {
      // ... same as before
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

  // ✅ UPDATED: Open Dialog -> Provision with Name -> Redirect
  async onCreateGroupChat(): Promise<void> {
    const currentUrn = this.conversationUrn();
    const currentParticipant = this.participant();
    const currentGroup = this.groups().find(
      (g) => g.id.toString() === currentUrn?.toString(),
    );

    if (!currentUrn || !currentParticipant) return;

    // 1. Open Setup Dialog
    const dialogRef = this.dialog.open(NetworkGroupSetupDialog, {
      width: '400px',
      data: {
        defaultName: currentParticipant.name,
        memberCount: currentGroup?.memberUrns?.length || 0,
      },
    });

    const resultName = await firstValueFrom(dialogRef.afterClosed());
    if (!resultName) return; // User cancelled

    // 2. Set Loading State
    this.isUpgrading.set(true);

    try {
      // 3. Provision (Passing new name)
      // Note: Ensure AppState.provisionNetworkGroup supports the 2nd arg
      const newGroupUrn = await this.appState.provisionNetworkGroup(
        currentUrn,
        resultName,
      );

      if (newGroupUrn) {
        // 4. Redirect to the NEW Entity
        await this.router.navigate(
          ['/messenger', 'conversations', newGroupUrn.toString()],
          { replaceUrl: true },
        );
      }
    } catch (error) {
      this.logger.error('Failed to create group chat', error);
    } finally {
      this.isUpgrading.set(false);
    }
  }
}
