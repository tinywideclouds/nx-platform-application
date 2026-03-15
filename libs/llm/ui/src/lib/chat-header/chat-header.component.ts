import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'llm-chat-header',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: 'chat-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmChatHeaderComponent {
  activeView = input<string | null>();
  sessionTitle = input<string | undefined>();

  closeView = output<void>();
  switchView = output<string>();

  // Maps the view ID to nice UI labels/icons
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
}
