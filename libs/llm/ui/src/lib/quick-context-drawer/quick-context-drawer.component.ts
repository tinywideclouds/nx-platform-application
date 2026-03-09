import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  LlmSession,
  QuickContextFile,
} from '@nx-platform-application/llm-types';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';
import { URN } from '@nx-platform-application/platform-types';

@Component({
  selector: 'llm-quick-context-drawer',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: 'quick-context-drawer.component.html',
})
export class LlmQuickContextDrawerComponent {
  private sessionActions = inject(LlmSessionActions);
  private snackBar = inject(MatSnackBar);

  session = input.required<LlmSession | null>();
  isOpen = signal(false);

  quickContext = computed(() => this.session()?.quickContext || []);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const sessionId = this.session()?.id;
      if (!sessionId) return;

      // Call our action that returns the pushed-off file (if any)
      const droppedFile = await this.sessionActions.addQuickFile(sessionId, {
        name: file.name,
        content,
      });

      if (droppedFile) {
        this.snackBar.open(
          `Removed '${droppedFile.name}' to make room for '${file.name}'`,
          'Got it',
          { duration: 5000 },
        );
      }

      // Auto-open the drawer so they can see the file was added
      this.isOpen.set(true);
    };

    reader.readAsText(file);
    input.value = ''; // Reset input so the same file can be selected again if needed
  }

  removeFile(fileId: URN): void {
    const sessionId = this.session()?.id;
    if (sessionId) {
      this.sessionActions.removeQuickFile(sessionId, fileId);
    }
  }
}
