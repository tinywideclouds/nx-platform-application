import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SSEProposalEvent } from '@nx-platform-application/llm-types';

type ViewMode = 'preview' | 'diff';

@Component({
  selector: 'llm-proposal-bubble',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './proposal-bubble.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmProposalBubbleComponent {
  // --- INPUTS & OUTPUTS ---
  event = input.required<SSEProposalEvent>();
  isExcluded = input<boolean>(false);

  accept = output<string>();
  reject = output<string>();
  openWorkspace = output<string>();

  // --- STATE ---
  viewMode = signal<ViewMode>('preview');
  isExpanded = signal<boolean>(false);
  actionTaken = signal<'accepted' | 'rejected' | null>(null);

  // --- COMPUTED VIEW LOGIC ---
  proposal = computed(() => this.event().proposal);

  status = computed(() => {
    // 1. Local transient action taken during this session
    if (this.actionTaken()) return this.actionTaken();
    // 2. Persisted exclusion state from the database
    if (this.isExcluded()) return 'rejected';
    // 3. Fallback: Always assume pending, ignoring LLM hallucinations
    return 'pending';
  });

  onAccept() {
    this.actionTaken.set('accepted');
    this.accept.emit(this.proposal().id);
  }

  onReject() {
    this.actionTaken.set('rejected');
    this.reject.emit(this.proposal().id);
  }

  toggleExpand() {
    this.isExpanded.update((v) => !v);
  }

  displayCode = computed(() => {
    const p = this.proposal();
    const expanded = this.isExpanded();

    // DIFF MODE
    if (this.viewMode() === 'diff') {
      if (p.patch) return p.patch;
      return '// Brand new file creation.\n// Switch to Preview to see the content.';
    }

    // PREVIEW MODE
    let contentToShow = '';

    if (p.patch) {
      contentToShow = this.extractCleanSnippet(p.patch);
    } else if (p.newContent) {
      contentToShow = p.newContent;
    } else {
      return '// No content provided';
    }

    // Truncate to 15 lines if we are collapsed to naturally limit height
    if (!expanded) {
      const lines = contentToShow.split('\n');
      if (lines.length > 15) {
        return (
          lines.slice(0, 15).join('\n') +
          '\n\n... (File truncated. Expand to view full file)'
        );
      }
    }

    return contentToShow;
  });

  // --- UTILS ---
  private extractCleanSnippet(patch: string): string {
    const lines = patch.split('\n');
    const cleanLines: string[] = [];

    for (const line of lines) {
      if (
        line.startsWith('---') ||
        line.startsWith('+++') ||
        line.startsWith('@@')
      ) {
        continue;
      }
      if (line.startsWith('-')) {
        continue;
      }
      if (line.startsWith('+')) {
        cleanLines.push(line.substring(1));
        continue;
      }
      if (line.startsWith(' ')) {
        cleanLines.push(line.substring(1));
        continue;
      }
      cleanLines.push(line);
    }

    return cleanLines.join('\n').trim();
  }
}
