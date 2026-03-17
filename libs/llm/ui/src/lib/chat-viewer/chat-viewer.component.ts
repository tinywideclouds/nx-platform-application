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

@Component({
  selector: 'llm-chat-viewer',
  standalone: true,
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
  private cacheService = inject(CompiledCacheService);

  isMobile = signal(false);
  showDetail = computed(() => !!this.sessionSource.activeSession());

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
