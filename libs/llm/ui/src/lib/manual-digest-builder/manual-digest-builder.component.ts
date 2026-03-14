import {
  Component,
  inject,
  signal,
  computed,
  effect,
  untracked,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MessageStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmDigestEngineService } from '@nx-platform-application/llm-domain-digest-engine';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmDigestSource } from '@nx-platform-application/llm-features-memory';
import { LlmMessage } from '@nx-platform-application/llm-types';

@Component({
  selector: 'llm-manual-digest-builder',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './manual-digest-builder.component.html',
})
export class LlmManualDigestBuilderComponent {
  private messageStorage = inject(MessageStorageService);
  private sessionSource = inject(LlmSessionSource);
  private digestSource = inject(LlmDigestSource);
  private digestEngine = inject(LlmDigestEngineService);
  private decoder = new TextDecoder();

  digestCreated = output<void>();

  messages = signal<LlmMessage[]>([]);
  rangeStart = signal<number | null>(null);
  rangeEnd = signal<number | null>(null);
  isProcessing = signal(false);

  constructor() {
    effect(async () => {
      const session = this.sessionSource.activeSession();
      if (session) {
        // Load raw messages and sort chronologically oldest to newest
        const raw = await this.messageStorage.getSessionMessages(session.id);
        const sorted = raw.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        this.messages.set(sorted);
      }
    });
  }

  // --- Range Selection Logic ---
  onMessageClick(index: number) {
    if (this.rangeStart() === null) {
      this.rangeStart.set(index);
      this.rangeEnd.set(index);
    } else if (
      this.rangeStart() !== null &&
      this.rangeStart() === this.rangeEnd()
    ) {
      // Second click sets the end range
      if (index < this.rangeStart()!) {
        this.rangeEnd.set(this.rangeStart());
        this.rangeStart.set(index);
      } else {
        this.rangeEnd.set(index);
      }
    } else {
      // Third click resets
      this.rangeStart.set(index);
      this.rangeEnd.set(index);
    }
  }

  isMessageSelected(index: number): boolean {
    const start = this.rangeStart();
    const end = this.rangeEnd();
    if (start === null || end === null) return false;
    return index >= start && index <= end;
  }

  selectedMessages = computed(() => {
    const start = this.rangeStart();
    const end = this.rangeEnd();
    if (start === null || end === null) return [];
    return this.messages().slice(start, end + 1);
  });

  getPreview(msg: LlmMessage): string {
    const text = msg.payloadBytes ? this.decoder.decode(msg.payloadBytes) : '';
    return text ? text : '[Tool Call / Attachment]';
  }

  async generateDigest() {
    const session = this.sessionSource.activeSession();
    const msgs = this.selectedMessages();
    if (!session || msgs.length === 0) return;

    this.isProcessing.set(true);
    try {
      const model = session.llmModel || 'gemini-3.1-pro';
      await this.digestEngine.processChunk(session.id, model, msgs);

      // Tell the timeline sidebar to refresh so it shows the new digest
      this.digestSource.refresh();

      this.rangeStart.set(null);
      this.rangeEnd.set(null);
      this.digestCreated.emit();
    } catch (e) {
      console.error(e);
    } finally {
      this.isProcessing.set(false);
    }
  }
}
