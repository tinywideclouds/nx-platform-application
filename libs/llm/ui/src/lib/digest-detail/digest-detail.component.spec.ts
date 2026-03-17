import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
  computed,
  signal,
  output,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { URN } from '@nx-platform-application/platform-types';

import { LlmDigestSource } from '@nx-platform-application/llm-features-memory';
import { MessageStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';

// --- CHANGED: Inject Domain Service ---
import { LlmDigestService } from '@nx-platform-application/llm-domain-digest';

import {
  ScrollspaceMarkdownBubbleComponent,
  MarkdownTokensPipe,
} from '@nx-platform-application/scrollspace-ui';
import { LlmDigestDetailInfoComponent } from '../digest-detail-info/digest-detail-info.component';
import { LlmDigestPreviewDialogComponent } from '../digest-preview-dialog/digest-preview.dialog';

@Component({
  selector: 'llm-digest-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    DatePipe,
    ScrollspaceMarkdownBubbleComponent,
    MarkdownTokensPipe,
    LlmDigestDetailInfoComponent,
  ],
  templateUrl: './digest-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmDigestDetailComponent {
  source = inject(LlmDigestSource);
  // --- CHANGED: Use Domain Service ---
  private digestService = inject(LlmDigestService);
  private messageStorage = inject(MessageStorageService);
  private proposalService = inject(LlmProposalService);
  private dialog = inject(MatDialog);

  digestId = input.required<URN | null>();
  navigate = output<URN>();

  // UI State
  isSidebarOpen = signal(true);
  isEditing = signal(false);
  editedContent = signal('');

  sortedTimeline = computed(() => {
    return [...this.source.digests()].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  });

  activeDigest = computed(() => {
    const id = this.digestId();
    if (!id) return null;
    return this.sortedTimeline().find((d) => d.id.equals(id)) || null;
  });

  // --- Edit Logic ---
  toggleEdit() {
    if (!this.isEditing()) {
      this.editedContent.set(this.activeDigest()?.content || '');
    }
    this.isEditing.set(!this.isEditing());
  }

  async saveEdit() {
    const current = this.activeDigest();
    if (!current) return;

    try {
      const updated = { ...current, content: this.editedContent() };
      // --- CHANGED: Use Domain Service ---
      await this.digestService.saveDigest(updated);
      this.source.refresh();
      this.isEditing.set(false);
    } catch (e) {
      console.error('Failed to save digest edit', e);
    }
  }

  // --- Context Preview Logic ---
  async openContextPreview() {
    const digest = this.activeDigest();
    if (!digest) return;

    try {
      const [allMsgs, proposals] = await Promise.all([
        this.messageStorage.getSessionMessages(digest.sessionId),
        this.proposalService.getProposalsForSession(digest.sessionId),
      ]);

      const targetIds = new Set(
        digest.coveredMessageIds.map((id) => id.toString()),
      );
      const coveredMsgs = allMsgs.filter((m) => targetIds.has(m.id.toString()));

      this.dialog.open(LlmDigestPreviewDialogComponent, {
        width: '800px',
        height: '80vh',
        data: {
          messages: coveredMsgs,
          includeRawProposals: false,
          systemPrompt:
            '[Historical Context View: The exact generation prompt was not recorded.]',
          activeProposals: proposals,
        },
      });
    } catch (e) {
      console.error('Failed to load context for preview', e);
    }
  }

  // --- Navigation Logic ---
  currentIndex = computed(() => {
    const active = this.activeDigest();
    if (!active) return -1;
    return this.sortedTimeline().findIndex((d) => d.id.equals(active.id));
  });

  prevDigest = computed(() => {
    const idx = this.currentIndex();
    if (idx > 0) return this.sortedTimeline()[idx - 1];
    return null;
  });

  nextDigest = computed(() => {
    const idx = this.currentIndex();
    const timeline = this.sortedTimeline();
    if (idx !== -1 && idx < timeline.length - 1) return timeline[idx + 1];
    return null;
  });

  goToPrev() {
    const prev = this.prevDigest();
    if (prev) {
      this.isEditing.set(false);
      this.navigate.emit(prev.id);
    }
  }

  goToNext() {
    const next = this.nextDigest();
    if (next) {
      this.isEditing.set(false);
      this.navigate.emit(next.id);
    }
  }
}
