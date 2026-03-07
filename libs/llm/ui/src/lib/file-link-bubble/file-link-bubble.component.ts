import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { URN } from '@nx-platform-application/platform-types';
import {
  PointerPayload,
  ProposalStatus,
  RegistryEntry,
} from '@nx-platform-application/llm-types';
import { ProposalRegistryStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Component({
  selector: 'llm-file-link-bubble',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
  ],
  templateUrl: './file-link-bubble.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // This locks the component's outer bounding box, preventing the CSS shrink-wrap anomaly
    class: 'block w-full',
  },
})
export class LlmFileLinkBubbleComponent {
  private registry = inject(ProposalRegistryStorageService);
  private logger = inject(Logger);

  // --- INPUTS & OUTPUTS ---
  pointer = input.required<PointerPayload>();
  isExcluded = input<boolean>(false);
  isGrouped = input<boolean>(false);
  hasConflicts = input<boolean>(false);

  accept = output<string>();
  reject = output<string>();
  openWorkspace = output<string>();

  // --- LOCAL STATE ---
  status = signal<ProposalStatus>('pending');
  heavyData = signal<RegistryEntry | null>(null);
  isLoading = signal<boolean>(false);
  isExpanded = signal<boolean>(false);
  isCopied = signal<boolean>(false);
  expandedViewMode = signal<'full' | 'diff'>('full');

  // --- COMPUTED VIEW MODELS ---
  private proposalUrn = computed(() => {
    const raw = this.pointer().proposalId as unknown as string;
    return raw.startsWith('urn:')
      ? URN.parse(raw)
      : URN.create('proposal', raw, 'llm');
  });

  readonly hasDiff = computed(() => {
    const heavy = this.heavyData();
    return !!heavy?.patch;
  });

  readonly displayCode = computed(() => {
    // 1. Normal View (Collapsed) -> Show the lightweight 12-line snippet
    if (!this.isExpanded()) {
      return this.pointer().snippet;
    }

    // 2. Expanded View -> Show Heavy Data
    const heavy = this.heavyData();
    if (!heavy) return this.pointer().snippet; // Fallback while loading

    // Show raw Git Patch
    if (this.expandedViewMode() === 'diff') {
      return heavy.patch || heavy.newContent || '// No changes recorded';
    }

    // Show Full Clean Content (Strip the diff markers)
    if (heavy.newContent) return heavy.newContent;
    if (heavy.patch) return this.extractCleanSnippet(heavy.patch);

    return '// No changes recorded';
  });

  constructor() {
    // Modern reactive approach: fetch the status whenever the bound input changes
    effect(() => {
      const urn = this.proposalUrn();
      this.fetchInitialStatus(urn);
    });
  }

  private async fetchInitialStatus(urn: URN) {
    try {
      const entry = await this.registry.getProposal(urn);
      if (entry) {
        this.status.set(entry.status || 'pending');
      }
    } catch (e) {
      this.logger.error('Failed to initialize FileLinkBubble status', e);
    }
  }

  // --- ACTIONS ---
  async toggleExpand() {
    if (!this.isExpanded()) {
      await this.loadHeavyData();
      this.isExpanded.set(true);
      this.expandedViewMode.set('full'); // Default to full content when opening
    } else {
      this.isExpanded.set(false);
    }
  }

  setExpandedViewMode(mode: 'full' | 'diff') {
    this.expandedViewMode.set(mode);
  }

  private async loadHeavyData() {
    if (this.heavyData()) return;

    this.isLoading.set(true);
    try {
      const entry = await this.registry.getProposal(this.proposalUrn());
      if (entry) {
        this.heavyData.set(entry);
        this.status.set(entry.status || 'pending');
      }
    } catch (e) {
      this.logger.error('Failed to load heavy diff from registry', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async copyToClipboard() {
    await this.loadHeavyData();
    const heavy = this.heavyData();

    let textToCopy = '';

    if (!this.isExpanded()) {
      // Normal View: User wants the full file, not just the preview snippet
      if (heavy?.newContent) {
        textToCopy = heavy.newContent;
      } else if (heavy?.patch) {
        textToCopy = this.extractCleanSnippet(heavy.patch);
      } else {
        textToCopy = this.pointer().snippet;
      }
    } else {
      // Expanded View: Copy exactly what they are looking at (Diff or Full)
      textToCopy = this.displayCode();
    }

    try {
      await navigator.clipboard.writeText(textToCopy);

      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    } catch (err) {
      this.logger.error('Failed to copy file link snippet', err);
    }
  }

  onAccept() {
    this.accept.emit(this.proposalUrn().toString());
  }

  onReject() {
    this.reject.emit(this.proposalUrn().toString());
  }

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
