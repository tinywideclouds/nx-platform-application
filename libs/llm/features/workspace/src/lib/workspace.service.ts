import {
  Injectable,
  signal,
  computed,
  inject,
  effect,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { applyPatch, createTwoFilesPatch } from 'diff';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

import { GithubSyncClient } from '@nx-platform-application/data-sources-infrastructure-data-access';
import { ChangeProposal } from '@nx-platform-application/llm-types';
import { FileMetadata } from '@nx-platform-application/data-sources-types';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';

import { healMalformedPatch } from './utils';
import { DataSourceResolver } from './datasource-resolver';

export interface ModifiedFile {
  filePath: string;
  metadata?: FileMetadata;
  isContentLoading: boolean;
  baseContent: string | null;
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
  private synClient = inject(GithubSyncClient);
  private proposalService = inject(LlmProposalService);
  private cacheService = inject(CompiledCacheService);
  private dataSources = inject(DataSourcesService);
  private resolver = inject(DataSourceResolver);

  private readonly baseMetadata = signal<Map<string, FileMetadata>>(new Map());
  private readonly baseContents = signal<Map<string, string>>(new Map());
  private readonly loadingSet = signal<Set<string>>(new Set());
  private readonly activeProposals = signal<ChangeProposal[]>([]);

  private readonly activeSessionId = computed(() =>
    this.sessionSource.activeSessionId(),
  );

  /**
   * REFACTORED: Centralized target resolution using the shared unrolling logic.
   */
  readonly availableTargets = computed(() => {
    const session = this.sessionSource.activeSession();
    if (!session) return [];

    const targetMap = new Map<string, URN>();

    const allAttachments = [
      ...(session.inlineContexts || []),
      ...(session.compiledContext ? [session.compiledContext] : []),
    ];

    allAttachments.forEach((att) => {
      if (att.resourceType === 'source') {
        targetMap.set(att.resourceUrn.toString(), att.resourceUrn);
      } else {
        const group = this.dataSources
          .dataGroups()
          .find((g) => g.id.equals(att.resourceUrn));

        group?.sources.forEach((s) =>
          targetMap.set(s.dataSourceId.toString(), s.dataSourceId),
        );
      }
    });

    return Array.from(targetMap.values());
  });

  readonly activeWorkspaceTarget = computed(() => {
    const session = this.sessionSource.activeSession();
    if (session?.workspaceTarget) return session.workspaceTarget;

    const available = this.availableTargets();
    if (available.length === 1) return available[0];

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
    /**
     * EFFECT 1: File List Hydration
     * Automatically fetches repository structure when the active target changes.
     */
    effect(async () => {
      const targetId = this.activeWorkspaceTarget();
      if (!targetId) {
        untracked(() => {
          this.baseMetadata.set(new Map());
          this.baseContents.set(new Map());
        });
        return;
      }

      try {
        const metadataList = await firstValueFrom(
          this.synClient.getFiles(targetId),
        );
        const metaMap = new Map<string, FileMetadata>();
        for (const meta of metadataList) metaMap.set(meta.path, meta);
        untracked(() => this.baseMetadata.set(metaMap));
      } catch (err) {
        this.logger.error(`Failed to fetch metadata for ${targetId}`, err);
        untracked(() => this.baseMetadata.set(new Map()));
      }
    });

    /**
     * EFFECT 2: Proposal Sync
     * Keeps the IDE's diff overlays in sync with the current chat session.
     */
    effect(async () => {
      const sessionId = this.activeSessionId();
      this.proposalService.registryMutated();

      if (!sessionId) {
        untracked(() => this.activeProposals.set([]));
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
     * EFFECT 3: Content JIT Loading
     * If a file has a proposal chain but no base text, fetch it from Github.
     */
    effect(() => {
      this.overlayMap().forEach((record, filePath) => {
        if (
          record.proposalChain.length > 0 &&
          record.baseContent === null &&
          !record.isContentLoading &&
          record.metadata
        ) {
          untracked(() => setTimeout(() => this.loadContent(filePath), 0));
        }
      });
    });
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
        this.synClient.getFileContent(targetId, base64Path),
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

    for (const proposal of this.activeProposals()) {
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
