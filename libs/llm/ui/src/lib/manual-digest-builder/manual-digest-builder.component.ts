import {
  Component,
  inject,
  signal,
  computed,
  effect,
  output,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MessageStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmDigestEngineService } from '@nx-platform-application/llm-domain-digest-engine';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmDigestSource } from '@nx-platform-application/llm-features-memory';
import {
  LlmMessage,
  FileProposalType,
  FileLinkType,
  RegistryEntry,
} from '@nx-platform-application/llm-types';
import { URN } from '@nx-platform-application/platform-types';

import {
  Prompts,
  StandardPrompt,
  ArchitecturalPrompt,
  DebugPrompt,
  MinimalPrompt,
} from '@nx-platform-application/llm-domain-digest-engine';

import { LlmDigestBuilderInfoComponent } from '../digest-builder-info/digest-builder-info.component';
import { LlmDigestPreviewDialogComponent } from '../digest-preview-dialog/digest-preview.dialog';

@Component({
  selector: 'llm-manual-digest-builder',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDialogModule,
    MatTooltipModule,
    LlmDigestBuilderInfoComponent,
  ],
  templateUrl: './manual-digest-builder.component.html',
})
export class LlmManualDigestBuilderComponent {
  private messageStorage = inject(MessageStorageService);
  private sessionSource = inject(LlmSessionSource);
  private digestSource = inject(LlmDigestSource);
  private digestEngine = inject(LlmDigestEngineService);
  private proposalService = inject(LlmProposalService);
  private dialog = inject(MatDialog);
  private decoder = new TextDecoder();

  digestCreated = output<URN>();
  messages = signal<LlmMessage[]>([]);
  activeProposals = signal<RegistryEntry[]>([]);
  isProcessing = signal(false);
  isSidebarOpen = signal(true);

  availableModels = [
    { label: 'Gemini 3.1 Pro (Recommended)', value: 'gemini-3.1-pro-preview' },
    { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' },
  ];

  selectedModel = signal('gemini-3.1-pro-preview');
  includeRawProposals = signal(false);
  selectedPromptText = signal(Prompts.Standard);

  rangeStart = signal<number | null>(null);
  rangeEnd = signal<number | null>(null);
  excludedIndices = signal<Set<number>>(new Set());

  constructor() {
    effect(async () => {
      const session = this.sessionSource.activeSession();
      if (session) {
        // Fetch Messages and Proposals concurrently!
        const [rawMsgs, rawProposals] = await Promise.all([
          this.messageStorage.getSessionMessages(session.id),
          this.proposalService.getProposalsForSession(session.id),
        ]);

        const sorted = rawMsgs.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        untracked(() => {
          this.messages.set(sorted);
          this.activeProposals.set(rawProposals);
          if (session.strategy?.primaryModel) {
            this.selectedModel.set(session.strategy.primaryModel);
          }
        });
      }
    });
  }

  // --- SELECTION LOGIC ---

  onMessageClick(index: number) {
    const start = this.rangeStart();
    const end = this.rangeEnd();

    if (start === null) {
      this.rangeStart.set(index);
      this.rangeEnd.set(null);
      this.excludedIndices.set(new Set());
    } else if (end === null) {
      if (index < start) {
        this.rangeStart.set(index);
        this.rangeEnd.set(start);
      } else {
        this.rangeEnd.set(index);
      }
    } else {
      if (index >= start && index <= end) {
        const exclusions = new Set(this.excludedIndices());
        if (exclusions.has(index)) {
          exclusions.delete(index);
        } else {
          exclusions.add(index);
        }
        this.excludedIndices.set(exclusions);
      } else {
        this.rangeStart.set(index);
        this.rangeEnd.set(null);
        this.excludedIndices.set(new Set());
      }
    }
  }

  isMessageInRange(index: number): boolean {
    const start = this.rangeStart();
    const end = this.rangeEnd();
    if (start === null) return false;
    if (end === null) return index === start;
    return index >= start && index <= end;
  }

  isMessageExcluded(index: number): boolean {
    return this.excludedIndices().has(index);
  }

  selectedMessages = computed(() => {
    const start = this.rangeStart();
    const end = this.rangeEnd();
    if (start === null || end === null) return [];

    const msgs: LlmMessage[] = [];
    for (let i = start; i <= end; i++) {
      if (!this.excludedIndices().has(i)) {
        msgs.push(this.messages()[i]);
      }
    }
    return msgs;
  });

  // --- OVERLAP, TYPE MAPPING & FEED LOGIC ---

  activeTypeId = computed(() => {
    const current = this.selectedPromptText();
    if (current === Prompts.Architectural) return ArchitecturalPrompt;
    if (current === Prompts.Debugging) return DebugPrompt;
    if (current === Prompts.Minimal) return MinimalPrompt;
    return StandardPrompt;
  });

  activePromptName = computed(() => {
    const current = this.selectedPromptText();
    if (current === Prompts.Architectural) return 'Architectural';
    if (current === Prompts.Debugging) return 'Debugging';
    if (current === Prompts.Minimal) return 'Minimal';
    return 'Standard';
  });

  overlappingDigestCount = computed(() => {
    const selectedMsgs = this.selectedMessages();
    if (selectedMsgs.length === 0) return 0;

    const typeUrn = this.activeTypeId();
    const typedDigests = this.digestSource
      .digests()
      .filter((d) => d.typeId.equals(typeUrn));
    const selectedIds = new Set(selectedMsgs.map((m) => m.id.toString()));

    let overlaps = 0;
    for (const digest of typedDigests) {
      const hasOverlap = digest.coveredMessageIds.some((id) =>
        selectedIds.has(id.toString()),
      );
      if (hasOverlap) overlaps++;
    }
    return overlaps;
  });

  feedItems = computed(() => {
    const msgs = this.messages();
    const typeUrn = this.activeTypeId();
    const relevantDigests = this.digestSource
      .digests()
      .filter((d) => d.typeId.equals(typeUrn));

    const items: any[] = [];
    const coveredMap = new Map<string, any>();

    for (const d of relevantDigests) {
      for (const id of d.coveredMessageIds) {
        coveredMap.set(id.toString(), d);
      }
    }

    let i = 0;
    while (i < msgs.length) {
      const msg = msgs[i];
      const digest = coveredMap.get(msg.id.toString());

      if (digest) {
        const startIndex = i;
        while (
          i < msgs.length &&
          coveredMap.get(msgs[i].id.toString()) === digest
        ) {
          i++;
        }
        items.push({
          type: 'digest',
          id: 'digest-' + digest.id.toString(),
          digest,
          count: i - startIndex,
        });
      } else {
        items.push({
          type: 'message',
          id: 'msg-' + msg.id.toString(),
          data: msg,
          originalIndex: i,
        });
        i++;
      }
    }
    return items;
  });

  estimatedTokens = computed(() => {
    const msgs = this.selectedMessages();
    const includeRaw = this.includeRawProposals();
    const prompt = this.selectedPromptText();
    const proposals = this.activeProposals();

    let totalStringLength = prompt.length;

    for (const msg of msgs) {
      if (!msg.payloadBytes) continue;

      const isTool =
        msg.typeId.equals(FileProposalType) || msg.typeId.equals(FileLinkType);

      if (isTool) {
        if (!includeRaw) {
          totalStringLength += 100;
        } else {
          const text = this.decoder.decode(msg.payloadBytes);
          try {
            const payload = JSON.parse(text);
            const urnStr = payload?.proposalId || payload?.pointer?.id;
            const fullProposal = proposals.find(
              (p) => p.id.toString() === urnStr,
            );
            const code =
              fullProposal?.patch ||
              fullProposal?.newContent ||
              payload.snippet ||
              '';

            totalStringLength +=
              code.length + (payload.reasoning?.length || 0) + 150;
          } catch {
            totalStringLength += msg.payloadBytes.length;
          }
        }
      } else {
        totalStringLength += msg.payloadBytes.length;
      }
    }
    return Math.ceil(totalStringLength / 4);
  });

  getPreview(msg: LlmMessage): string {
    const text = msg.payloadBytes ? this.decoder.decode(msg.payloadBytes) : '';
    return text ? text : '[Tool Call / Attachment]';
  }

  // --- ACTIONS ---

  openPreview() {
    this.dialog.open(LlmDigestPreviewDialogComponent, {
      width: '800px',
      height: '80vh',
      data: {
        messages: this.selectedMessages(),
        includeRawProposals: this.includeRawProposals(),
        systemPrompt: this.selectedPromptText(),
        activeProposals: this.activeProposals(), // Sent strictly to the dialog
        showSnippetWarning: true,
      },
    });
  }

  async generateDigest() {
    const session = this.sessionSource.activeSession();
    const msgs = this.selectedMessages();

    if (!session || msgs.length === 0 || this.overlappingDigestCount() > 0)
      return;

    this.isProcessing.set(true);
    try {
      const newId = await this.digestEngine.processChunk(
        session.id,
        this.selectedModel(),
        msgs,
        {
          includeRawProposals: this.includeRawProposals(),
          customPrompt: this.selectedPromptText(),
          typeId: this.activeTypeId(),
        },
      );

      this.rangeStart.set(null);
      this.rangeEnd.set(null);
      this.excludedIndices.set(new Set());
      if (newId) this.digestCreated.emit(newId);
    } catch (e) {
      console.error(e);
    } finally {
      this.isProcessing.set(false);
    }
  }
}
