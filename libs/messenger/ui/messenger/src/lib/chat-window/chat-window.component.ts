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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services
import { AppState } from '@nx-platform-application/messenger-state-app';
import {
  ChatDataService,
  UIConversation,
} from '@nx-platform-application/messenger-state-chat-data';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// Components
import {
  ChatWindowHeaderComponent,
  ChatWindowMode,
  NetworkGroupSetupDialog,
} from '@nx-platform-application/messenger-ui-chat';

@Component({
  selector: 'messenger-chat-window',
  standalone: true,
  imports: [
    RouterOutlet,
    ChatWindowHeaderComponent,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  protected appState = inject(AppState);
  private chatData = inject(ChatDataService);
  private logger = inject(Logger);

  // --- 1. Router State (Restored) ---

  // Detects if we are in 'chat' or 'details' mode based on URL
  viewMode = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() =>
        this.router.url.endsWith('/details')
          ? ('details' as ChatWindowMode)
          : ('chat' as ChatWindowMode),
      ),
    ),
    { initialValue: 'chat' as ChatWindowMode },
  );

  private routeParams = toSignal(this.route.paramMap);

  // Robust URN parsing (State Recovery)
  conversationUrn = computed(() => {
    const urnStr = this.routeParams()?.get('id');
    if (!urnStr) return null;
    try {
      return URN.parse(urnStr);
    } catch (err) {
      this.logger.error('Failed to parse URN from route:', err);
      return null;
    }
  });

  // --- 2. View Model (The New Logic) ---

  title = computed(() => {
    return this.appState.selectedConversation()?.name || 'Unknown';
  });

  // Derived from the rich view model (if available).
  participant = computed(() => {
    const current = this.appState.selectedConversation();
    if (!current) return null;

    // Try to find rich data in the active list
    const richData: UIConversation | undefined = this.chatData
      .uiConversations()
      .find((c: UIConversation) => c.id.equals(current.id));

    if (!richData) {
      return {
        name: 'unknown',
        id: URN.parse('urn:messenger:conversation:unknown'),
        initials: '??',
        url: undefined,
      };
    }

    // Fallback initials from the DB name if rich data is missing
    const name = richData.name || current.name || '?';

    return {
      id: richData.id,
      name: richData.name,
      initials: name.slice(0, 2).toUpperCase(),
      url: richData.pictureUrl,
    };
  });

  isLoading = signal(false);
  isUpgrading = signal(false);
  isKeyMissing = this.appState.isRecipientKeyMissing;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.appState.loadConversation(null);
    });

    // --- 3. The "Load Effect" (Restored & Cleaned) ---
    // Reacts to URL changes -> Triggers DB Load
    effect(() => {
      const urn = this.conversationUrn();

      untracked(async () => {
        if (urn) {
          this.isLoading.set(true);
          try {
            await this.appState.loadConversation(urn);
          } catch (e) {
            this.logger.error('Failed to load conversation', e);
            // Optionally redirect to 404
          } finally {
            this.isLoading.set(false);
          }
        } else {
          await this.appState.loadConversation(null);
        }
      });
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

  // ✅ RESTORED: Toggle Info logic
  onToggleInfo(): void {
    const target = this.viewMode() === 'chat' ? 'details' : './';
    this.router.navigate([target], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
    });
  }

  async onCreateGroupChat(): Promise<void> {
    const current = this.participant();
    if (!current) return;

    // 1. Open Setup Dialog
    const dialogRef = this.dialog.open(NetworkGroupSetupDialog, {
      width: '400px',
      data: {
        defaultName: current.name,
        memberCount: 0, // We can wire this up to real count later
      },
    });

    const resultName = await firstValueFrom(dialogRef.afterClosed());
    if (!resultName) return;

    this.isUpgrading.set(true);

    try {
      // 2. Provision Network Group
      const newGroupUrn = await this.appState.provisionNetworkGroup(
        current.id,
        resultName,
      );

      if (newGroupUrn) {
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
