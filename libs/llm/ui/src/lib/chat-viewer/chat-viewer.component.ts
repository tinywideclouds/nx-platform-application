import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Temporal } from '@js-temporal/polyfill';

// LAYOUT & UI
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';
import { LlmSessionSidebarComponent } from '../session-sidebar/session-sidebar.component';
import { LlmChatWindowComponent } from '../chat-window/chat-window.component';

// DOMAIN
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmScrollSource } from '@nx-platform-application/llm-features-chat';
import { LlmChatActions } from '@nx-platform-application/llm-domain-conversation';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';
import { ChatWorkspacePresenter } from '../chat-window/chat-window.presenter'; // HOISTED

@Component({
  selector: 'llm-chat-viewer',
  standalone: true,
  providers: [ChatWorkspacePresenter], // THIS ENSURES STATE IS SHARED WITH CHAT-WINDOW
  imports: [
    MatIconModule,
    MatButtonModule,
    MasterDetailLayoutComponent,
    LlmSessionSidebarComponent,
    LlmChatWindowComponent,
  ],
  templateUrl: './chat-viewer.component.html',
  styleUrl: './chat-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmChatViewerComponent {
  private router = inject(Router);
  protected sessionSource = inject(LlmSessionSource);

  // Injected for the hoisted header
  protected source = inject(LlmScrollSource);
  protected actions = inject(LlmChatActions);
  protected presenter = inject(ChatWorkspacePresenter);
  private cacheService = inject(CompiledCacheService);

  isMobile = signal(false);
  showDetail = computed(() => !!this.sessionSource.activeSession());

  // Hoisted alert logic
  chatAlertState = computed(() => {
    const session = this.presenter.session();
    if (!session || !this.presenter.activeModelId())
      return { alert: false, reason: '' };
    if (this.cacheService.isCompiling())
      return {
        alert: true,
        reason: '⚙️ Compiling context cache... please wait.',
      };
    const isUsingOverride = !!this.presenter.temporaryModelOverride();

    if (session.compiledContext) {
      const activeCache = this.cacheService
        .activeCaches()
        .find(
          (c) =>
            c.model === this.presenter.activeModelId() &&
            c.id
              .toString()
              .includes(session.compiledContext!.resourceUrn.entityId),
        );
      if (activeCache) {
        if (
          Temporal.Instant.compare(
            Temporal.Now.instant(),
            Temporal.Instant.from(activeCache.expiresAt),
          ) >= 0
        ) {
          return {
            alert: true,
            reason: '⏰ Context cache expired. Responses will be slower.',
          };
        }
      } else if (!isUsingOverride && session.strategy?.useCacheIfAvailable) {
        return {
          alert: true,
          reason: '❄️ Context cache is COLD. Response will be slow.',
        };
      }
    }
    return { alert: false, reason: '' };
  });

  onOpenDetails() {
    this.router.navigate([], {
      queryParams: { view: 'details' },
      queryParamsHandling: 'merge',
    });
  }
  onOpenMemory() {
    this.router.navigate([], {
      queryParams: { view: 'memory' },
      queryParamsHandling: 'merge',
    });
  }
  onOpenWorkspace() {
    this.router.navigate([], {
      queryParams: { view: 'workspace' },
      queryParamsHandling: 'merge',
    });
  }

  clearSelection(): void {
    this.router.navigate(['/chat'], { queryParamsHandling: 'preserve' });
  }
}
