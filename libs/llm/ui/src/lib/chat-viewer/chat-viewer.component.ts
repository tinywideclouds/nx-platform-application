import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

// LAYOUT & UI
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';

// FEATURE COMPONENTS
import { LlmSessionSidebarComponent } from '../session-sidebar/session-sidebar.component';
import { LlmChatWindowComponent } from '../chat-window/chat-window.component';
import { LlmSessionPageComponent } from '../session-page/session-page.component';
import { LlmSessionWorkspaceComponent } from '../session-workspace/session-workspace.component';

@Component({
  selector: 'llm-chat-viewer',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MasterDetailLayoutComponent,
    LlmSessionSidebarComponent,
    LlmSessionPageComponent,
    LlmSessionWorkspaceComponent,
    LlmChatWindowComponent,
  ],
  templateUrl: './chat-viewer.component.html',
  styleUrl: './chat-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmChatViewerComponent {
  private router = inject(Router);

  // ROUTER INPUT: 'urn:llm:session:...' or undefined
  readonly sessionId = input<string | undefined>(undefined);

  readonly viewMode = input<string | undefined>(undefined, { alias: 'view' });

  // UI State
  isMobile = signal(false);

  // Layout Driver: Show detail pane if a session is actively selected
  showDetail = computed(() => !!this.sessionId());

  // --- ACTIONS ---

  clearSelection(): void {
    // Navigates back to the base route (showing the sidebar on mobile)
    this.router.navigate(['/chat']);
  }

  closeModalView(): void {
    // Clears the ?view= parameter to return to the chat conversation
    this.router.navigate([], {
      queryParams: { view: null, proposal: null },
      queryParamsHandling: 'merge',
    });
  }
}
