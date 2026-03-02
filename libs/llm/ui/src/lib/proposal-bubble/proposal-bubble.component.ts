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

  // Clean, binary grouping awareness
  isGrouped = input<boolean>(false);

  accept = output<string>();
  reject = output<string>();
  openWorkspace = output<string>();

  // --- STATE ---
  viewMode = signal<ViewMode>('preview');
  isExpanded = signal<boolean>(false);
  actionTaken = signal<'accepted' | 'rejected' | null>(null);
  isCopied = signal<boolean>(false);

  // --- COMPUTED VIEW LOGIC ---
  proposal = computed(() => this.event().proposal);

  // Check if we actually have a diff to show
  hasDiff = computed(() => !!this.proposal().patch);

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
    const mode = this.viewMode();
    const patch = this.proposal().patch;
    const newContent = this.proposal().newContent;
    const expanded = this.isExpanded();

    let contentToShow = '';

    if (mode === 'diff' && patch) {
      contentToShow = patch;
    } else if (newContent) {
      contentToShow = newContent;
    } else if (patch) {
      contentToShow = this.extractCleanSnippet(patch);
    } else {
      contentToShow = '// No content available';
    }

    // Truncate logic if not expanded and it's too long
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

  async copyToClipboard() {
    try {
      let textToCopy = '';

      if (this.viewMode() === 'diff') {
        textToCopy = this.proposal().patch || '';
      } else {
        textToCopy = this.proposal().newContent || this.displayCode();
      }

      await navigator.clipboard.writeText(textToCopy);

      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  }
}
