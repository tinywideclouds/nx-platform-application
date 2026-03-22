import {
  Injectable,
  signal,
  computed,
  inject,
  effect,
  untracked,
} from '@angular/core';
import { applyPatch, createTwoFilesPatch } from 'diff';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

import { ChangeProposal } from '@nx-platform-application/llm-types';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';

// We now import the clean adapter contract, NOT the infrastructure!
import { LlmTargetProvider } from '@nx-platform-application/llm-domain-data-target';

import { healMalformedPatch } from './utils';

export interface ModifiedFile {
  filePath: string;
  isContentLoading: boolean;
  baseContent: string | null; // null means the file doesn't exist in the target (e.g., new file)
  proposalChain: ChangeProposal[];
}

export interface ChainResolution {
  content: string | null;
  healedPatch?: string;
  failedProposalId?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStateService {
  private readonly logger = inject(Logger);
  private sessionSource = inject(LlmSessionSource);
  private proposalService = inject(LlmProposalService);
  private targetProvider = inject(LlmTargetProvider);

  // We only store contents for files we are actively proposing edits to
  private readonly baseContents = signal<Map<string, string | null>>(new Map());
  private readonly loadingSet = signal<Set<string>>(new Set());
  private readonly activeProposals = signal<ChangeProposal[]>([]);

  private readonly activeSessionId = computed(() =>
    this.sessionSource.activeSessionId(),
  );

  /**
   * The destination sandbox where the LLM is writing.
   */
  readonly activeWorkspaceTarget = computed(() => {
    const session = this.sessionSource.activeSession();
    return session?.workspaceTarget || null;
  });

  readonly hasStagedChanges = computed(() => {
    for (const record of this.overlayMap().values()) {
      if (record.proposalChain.some((p) => p.status === 'staged')) {
        return true;
      }
    }
    return false;
  });

  constructor() {
    /**
     * EFFECT 1: Proposal Sync
     * We simply listen for LLM proposals. The UI is driven entirely by this.
     */
    effect(async () => {
      const sessionId = this.activeSessionId();
      this.proposalService.registryMutated();

      if (!sessionId) {
        untracked(() => {
          this.activeProposals.set([]);
          this.baseContents.set(new Map());
        });
        return;
      }

      try {
        const entries =
          await this.proposalService.getProposalsForSession(sessionId);
        entries.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        untracked(() =>
          this.activeProposals.set(
            entries.map((e) => ({
              id: e.id.toString(),
              sessionId: e.ownerSessionId,
              filePath: e.filePath,
              patch: e.patch,
              newContent: e.newContent,
              reasoning: e.reasoning,
              status: e.status,
              createdAt: e.createdAt,
            })),
          ),
        );
      } catch (e) {
        this.logger.error('Failed to load session proposals', e);
      }
    });

    /**
     * EFFECT 2: JIT Base Content Loading
     * If a proposal arrives for a file we haven't fetched the base text for, fetch it now.
     */
    effect(() => {
      const targetId = this.activeWorkspaceTarget();
      if (!targetId) return;

      this.overlayMap().forEach((record, filePath) => {
        // If the file is NOT in the baseContents map, we haven't attempted to fetch it yet.
        if (
          !this.baseContents().has(filePath) &&
          !this.loadingSet().has(filePath)
        ) {
          untracked(() =>
            setTimeout(() => this.loadContent(filePath, targetId), 0),
          );
        }
      });
    });
  }

  async loadContent(filePath: string, targetId: URN): Promise<void> {
    if (this.baseContents().has(filePath) || this.loadingSet().has(filePath))
      return;

    this.loadingSet.update((set) => new Set(set).add(filePath));

    try {
      // Ask the agnostic provider for the file.
      // It returns null if it's a 404/New File.
      const content = await this.targetProvider.getBaseFileContent(
        targetId,
        filePath,
      );

      this.baseContents.update((map) => new Map(map).set(filePath, content));
    } catch (err) {
      this.logger.error(
        `Failed to load base content for ${filePath} from target ${targetId}`,
        err,
      );
      // Fallback to null so we don't get stuck in an infinite loading loop
      this.baseContents.update((map) => new Map(map).set(filePath, null));
    } finally {
      this.loadingSet.update((set) => {
        const newSet = new Set(set);
        newSet.delete(filePath);
        return newSet;
      });
    }
  }

  /**
   * The list of files the LLM is actively modifying.
   */
  readonly overlayMap = computed(() => {
    const fileMap = new Map<string, ModifiedFile>();
    const contents = this.baseContents();
    const loading = this.loadingSet();

    for (const proposal of this.activeProposals()) {
      if (!fileMap.has(proposal.filePath)) {
        fileMap.set(proposal.filePath, {
          filePath: proposal.filePath,
          isContentLoading: loading.has(proposal.filePath),
          // Explicitly check if it exists in the map, otherwise undefined
          baseContent: contents.has(proposal.filePath)
            ? (contents.get(proposal.filePath) ?? null)
            : null,
          proposalChain: [],
        });
      }
      fileMap.get(proposal.filePath)!.proposalChain.push(proposal);
    }
    return fileMap;
  });

  resolveChainState(
    record: ModifiedFile,
    targetProposalId?: string | null,
  ): ChainResolution {
    let currentText = record.baseContent || '';
    if (!targetProposalId && record.baseContent === null)
      return { content: null };

    for (const proposal of record.proposalChain) {
      if (proposal.status === 'rejected') {
        if (proposal.id === targetProposalId) break;
        continue;
      }
      if (proposal.newContent) {
        currentText = proposal.newContent;
      } else if (proposal.patch) {
        try {
          const patchedResult = applyPatch(currentText, proposal.patch);
          if (patchedResult === false)
            return {
              content: currentText,
              error: `Conflict at ${proposal.id}`,
            };
          currentText = patchedResult;
        } catch (err: any) {
          const healedPatch = healMalformedPatch(proposal.patch);
          const healedResult = applyPatch(currentText, healedPatch);
          if (healedResult !== false)
            return {
              content: healedResult,
              error: 'Malformed Diff',
              healedPatch,
              failedProposalId: proposal.id,
            };
          return {
            content: currentText,
            error: `Malformed diff at ${proposal.id}`,
          };
        }
      }
      if (proposal.id === targetProposalId) break;
    }
    return { content: currentText };
  }

  generateStagedPatch(): string {
    let unifiedPatch = '';
    this.overlayMap().forEach((record, filePath) => {
      const stagedProposals = record.proposalChain.filter(
        (p) => p.status === 'staged',
      );
      if (stagedProposals.length === 0) return;
      const res = this.resolveChainState(
        record,
        stagedProposals[stagedProposals.length - 1].id,
      );
      if (!res.error)
        unifiedPatch +=
          createTwoFilesPatch(
            `a/${filePath}`,
            `b/${filePath}`,
            record.baseContent || '',
            res.content || '',
            '',
            '',
            { context: 3 },
          ) + '\n';
    });
    return unifiedPatch;
  }

  readonly conflictsMap = computed(() => {
    const conflicts = new Map<string, boolean>();
    this.overlayMap().forEach((record, filePath) => {
      conflicts.set(
        filePath,
        record.proposalChain.length > 0 &&
          this.resolveChainState(record).error !== undefined,
      );
    });
    return conflicts;
  });

  readonly driftScore = computed(() => {
    let count = 0;
    this.overlayMap().forEach((record) => {
      if (record.proposalChain.some((p) => p.status === 'accepted')) count++;
    });
    return count;
  });

  readonly requiresRecompile = computed(() => this.driftScore() > 0);
}
