import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject, // <-- ADD
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session'; // <-- ADD

@Component({
  selector: 'llm-chat-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterModule],
  templateUrl: 'chat-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmChatHeaderComponent {
  private sessionSource = inject(LlmSessionSource); // <-- ADD

  activeView = input<string | null>();
  sessionTitle = input<string | undefined>();

  closeView = output<void>();
  switchView = output<string>();

  viewMetadata = computed(() => {
    const view = this.activeView();
    switch (view) {
      case 'workspace':
        return { label: 'Workspace', icon: 'folder_open' };
      case 'memory':
        return { label: 'Session Memory', icon: 'history' };
      case 'details':
        return { label: 'Session Settings', icon: 'settings' };
      default:
        return null;
    }
  });

  // --- ADDED ---
  clearSession() {
    this.sessionSource.setActiveSession(null);
  }
}
