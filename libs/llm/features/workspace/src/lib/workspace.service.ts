import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { applyPatch, createTwoFilesPatch } from 'diff';
import {
  FileMetadata,
  ChangeProposal,
} from '@nx-platform-application/llm-types';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';
import { LlmGithubFirestoreClient } from '@nx-platform-application/llm-infrastructure-github-firestore-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';
import { healMalformedPatch } from './utils';

export interface ModifiedFile {
  filePath: string;
  metadata?: FileMetadata;
  isContentLoading: boolean;
  baseContent: string | null;
  proposalChain: ChangeProposal[];
}

export interface ChainResolution {
  content: string | null;
  healedPatch?: string; // NEW: The corrected diff string
  failedProposalId?: string; // NEW: Which proposal caused the crash
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStateService {
  private readonly logger = inject(Logger);
  private sessionSource = inject(LlmSessionSource); // Only care about sessions now!
  private firestoreClient = inject(LlmGithubFirestoreClient);
  private proposalService = inject(LlmProposalService);

  private readonly baseMetadata = signal<Map<string, FileMetadata>>(new Map());
  private readonly baseContents = signal<Map<string, string>>(new Map());
  private readonly loadingSet = signal<Set<string>>(new Set());

  private readonly activeProposals = signal<ChangeProposal[]>([]);

  // Inherit directly from the new centralized source
  private readonly activeSessionId = computed(() =>
    this.sessionSource.activeSessionId(),
  );

  // --- WORKSPACE TARGET STATE ---
  readonly availableTargets = computed(() => {
    const session = this.sessionSource.activeSession();
    if (!session || !session.attachments) return [];
    return session.attachments.filter((a) => a.target === 'compiled-cache');
  });

  readonly activeWorkspaceTarget = computed(() => {
    const session = this.sessionSource.activeSession();
    if (session?.workspaceTarget) return session.workspaceTarget;

    const available = this.availableTargets();
    if (available.length === 1) return available[0].cacheId;

    return null;
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
    // 1. Base File Fetcher Effect (Now explicitly bound to targetId)
    effect(async () => {
      const targetId = this.activeWorkspaceTarget();

      this.proposalService.registryMutated();

      if (!targetId) {
        this.baseMetadata.set(new Map());
        this.baseContents.set(new Map());
        return;
      }
      try {
        const metadataList = await firstValueFrom(
          this.firestoreClient.getFiles(targetId),
        );
        const metaMap = new Map<string, FileMetadata>();
        for (const meta of metadataList) {
          metaMap.set(meta.path, meta);
        }
        this.baseMetadata.set(metaMap);
      } catch (err) {
        this.logger.error(
          `Failed to fetch metadata for target ${targetId.toString()}`,
          err,
        );
        this.baseMetadata.set(new Map());
      }
    });

    // 2. The Pure Registry Query Effect
    effect(async () => {
      const sessionId = this.activeSessionId();
      if (!sessionId) {
        this.activeProposals.set([]);
        return;
      }

      try {
        const entries =
          await this.proposalService.getProposalsForSession(sessionId);

        entries.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        const proposals: ChangeProposal[] = entries.map((entry) => ({
          id: entry.id.toString(),
          sessionId: entry.ownerSessionId,
          filePath: entry.filePath,
          patch: entry.patch,
          newContent: entry.newContent,
          reasoning: entry.reasoning,
          status: entry.status || 'pending',
          createdAt: entry.createdAt,
        }));

        this.activeProposals.set(proposals);
      } catch (e) {
        this.logger.error('Failed to load proposals from registry', e);
      }
    });

    // 3. Auto-Loader Effect
    effect(() => {
      const fileMap = this.overlayMap();
      fileMap.forEach((record, filePath) => {
        const hasProposals = record.proposalChain.length > 0;
        const needsContent =
          record.baseContent === null &&
          !record.isContentLoading &&
          record.metadata;

        if (hasProposals && needsContent) {
          setTimeout(() => this.loadContent(filePath), 0);
        }
      });
    });
  }

  generateStagedPatch(): string {
    let unifiedPatch = '';

    this.overlayMap().forEach((record, filePath) => {
      const stagedProposals = record.proposalChain.filter(
        (p) => p.status === 'staged',
      );
      if (stagedProposals.length === 0) return;

      const lastStagedId = stagedProposals[stagedProposals.length - 1].id;
      const resolution = this.resolveChainState(record, lastStagedId);

      if (resolution.error) {
        this.logger.warn(
          `Skipping patch generation for ${filePath} due to conflict: ${resolution.error}`,
        );
        return;
      }

      const baseText = record.baseContent || '';
      const stagedText = resolution.content || '';

      if (baseText === stagedText) return;

      const filePatch = createTwoFilesPatch(
        `a/${filePath}`,
        `b/${filePath}`,
        baseText,
        stagedText,
        '',
        '',
        { context: 3 },
      );

      unifiedPatch += filePatch + '\n';
    });

    return unifiedPatch;
  }

  private encodePathForGo(filePath: string): string {
    return btoa(unescape(encodeURIComponent(filePath)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  async loadContent(filePath: string): Promise<void> {
    const targetId = this.activeWorkspaceTarget();
    if (
      !targetId ||
      this.baseContents().has(filePath) ||
      this.loadingSet().has(filePath)
    )
      return;

    this.loadingSet.update((set) => new Set(set).add(filePath));
    try {
      const base64Path = this.encodePathForGo(filePath);
      const res = await firstValueFrom(
        this.firestoreClient.getFileContent(targetId, base64Path),
      );
      this.baseContents.update((map) =>
        new Map(map).set(filePath, res.content),
      );
    } catch (err) {
      this.logger.error(`Failed to load content for ${filePath}`, err);
    } finally {
      this.loadingSet.update((set) => {
        const newSet = new Set(set);
        newSet.delete(filePath);
        return newSet;
      });
    }
  }

  readonly overlayMap = computed(() => {
    const fileMap = new Map<string, ModifiedFile>();
    const metaTree = this.baseMetadata();
    const contents = this.baseContents();
    const loading = this.loadingSet();

    metaTree.forEach((meta, filePath) => {
      fileMap.set(filePath, {
        filePath,
        metadata: meta,
        isContentLoading: loading.has(filePath),
        baseContent: contents.get(filePath) || null,
        proposalChain: [],
      });
    });

    const proposals = this.activeProposals();

    for (const proposal of proposals) {
      if (!fileMap.has(proposal.filePath)) {
        fileMap.set(proposal.filePath, {
          filePath: proposal.filePath,
          isContentLoading: false,
          baseContent: null,
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
        // If the user explicitly clicks a rejected proposal tab in the UI,
        // we stop here so they see the state of the code *right before* it was rejected.
        // They can use the "Raw Diff" toggle to see the bad code itself.
        if (proposal.id === targetProposalId) break;
        continue;
      }

      if (proposal.newContent) {
        currentText = proposal.newContent;
      } else if (proposal.patch) {
        try {
          const patchedResult = applyPatch(currentText, proposal.patch);
          if (patchedResult === false) {
            return {
              content: currentText,
              error: `// ERROR: Chain conflict at Proposal ${proposal.id}.\n// The preceding patches did not result in a valid base for this diff.\n\n${proposal.patch}`,
            };
          }
          currentText = patchedResult;
        } catch (err: any) {
          // Handles structurally broken diffs (LLM hallucinated wrong line counts)
          // 2. If it's a syntax error (like bad math), attempt to HEAL it
          if (
            err.message.includes('line count did not match') ||
            err.message.includes('invalid line')
          ) {
            try {
              const healedPatch = healMalformedPatch(proposal.patch);
              const healedResult = applyPatch(currentText, healedPatch);

              if (healedResult !== false) {
                // Return the error, but provide the healed code as the preview
                return {
                  content: healedResult,
                  error: `Malformed Diff Syntax. The LLM hallucinated the line counts. An auto-fix is available (shown but unapplied)`,
                  healedPatch: healedPatch,
                  failedProposalId: proposal.id,
                };
              }
            } catch (healErr) {
              // The patch was too mangled to heal
            }
          }
          return {
            content: currentText,
            error: `// ERROR: Malformed diff syntax from LLM at Proposal ${proposal.id}.\n// Detail: ${err.message}\n\n${proposal.patch}`,
          };
        }
      }

      if (proposal.id === targetProposalId) {
        break;
      }
    }

    return { content: currentText };
  }

  readonly conflictsMap = computed(() => {
    const conflicts = new Map<string, boolean>();

    this.overlayMap().forEach((record, filePath) => {
      if (record.proposalChain.length === 0) {
        conflicts.set(filePath, false);
        return;
      }

      const resolution = this.resolveChainState(record);
      conflicts.set(filePath, resolution.error !== undefined);
    });

    return conflicts;
  });

  readonly driftScore = computed(() => {
    let count = 0;

    this.overlayMap().forEach((record) => {
      const hasAccepted = record.proposalChain.some(
        (p) => p.status === 'accepted',
      );
      if (hasAccepted) {
        count++;
      }
    });

    return count;
  });

  readonly requiresRecompile = computed(() => {
    return this.driftScore() > 0;
  });
}
