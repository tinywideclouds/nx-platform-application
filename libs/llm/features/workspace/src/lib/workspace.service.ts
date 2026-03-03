import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { applyPatch } from 'diff';
import { URN } from '@nx-platform-application/platform-types';
import {
  LlmMessage,
  SSEProposalEvent,
  FileProposalType,
  FileMetadata,
} from '@nx-platform-application/llm-types';
import { ChangeProposal } from '@nx-platform-application/llm-types';
import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import { LlmGithubFirestoreClient } from '@nx-platform-application/llm-infrastructure-github-firestore-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

export interface ModifiedFile {
  filePath: string;
  metadata?: FileMetadata;
  isContentLoading: boolean;
  baseContent: string | null;
  // The strictly chronological sequence of all proposals in this session
  proposalChain: ChangeProposal[];
}

export interface ChainResolution {
  content: string | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStateService {
  private readonly logger = inject(Logger);
  private scrollSource = inject(LlmScrollSource);
  private sessionSource = inject(LlmSessionSource);
  private firestoreClient = inject(LlmGithubFirestoreClient);

  private readonly baseMetadata = signal<Map<string, FileMetadata>>(new Map());
  private readonly baseContents = signal<Map<string, string>>(new Map());
  private readonly loadingSet = signal<Set<string>>(new Set());

  private readonly sessionMessages = computed(() => {
    return this.scrollSource
      .items()
      .filter((item) => item.type === 'content')
      .map((item) => item.data as LlmMessage);
  });

  readonly activeCacheId = computed(() => {
    const sessionId = this.scrollSource.activeSessionId();
    if (!sessionId) return null;
    const session = this.sessionSource
      .sessions()
      .find((s) => s.id.equals(sessionId));
    return session?.geminiCache || null;
  });

  constructor() {
    effect(async () => {
      const cacheId = this.activeCacheId();
      if (!cacheId) {
        this.baseMetadata.set(new Map());
        this.baseContents.set(new Map());
        return;
      }
      try {
        const metadataList = await firstValueFrom(
          this.firestoreClient.getFiles(cacheId),
        );
        const metaMap = new Map<string, FileMetadata>();
        for (const meta of metadataList) {
          metaMap.set(meta.path, meta);
        }
        this.baseMetadata.set(metaMap);
      } catch (err) {
        this.logger.error(`Failed to fetch metadata for cache ${cacheId}`, err);
        this.baseMetadata.set(new Map());
      }
    });

    // Auto-Loader updated to check the chain
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

  // ... (encodePathForGo and loadContent remain the same) ...
  private encodePathForGo(filePath: string): string {
    return btoa(unescape(encodeURIComponent(filePath)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  async loadContent(filePath: string): Promise<void> {
    const cacheId = this.activeCacheId();
    if (
      !cacheId ||
      this.baseContents().has(filePath) ||
      this.loadingSet().has(filePath)
    )
      return;

    this.loadingSet.update((set) => new Set(set).add(filePath));
    try {
      const base64Path = this.encodePathForGo(filePath);
      const res = await firstValueFrom(
        this.firestoreClient.getFileContent(cacheId, base64Path),
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

  // --- NEW ENGINE CORE ---

  readonly overlayMap = computed(() => {
    const fileMap = new Map<string, ModifiedFile>();
    const messages = this.sessionMessages();
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

    const decoder = new TextDecoder();

    for (const msg of messages) {
      if (!msg.payloadBytes || !msg.typeId.equals(FileProposalType)) continue;

      try {
        const text = decoder.decode(msg.payloadBytes);
        const parsed = JSON.parse(text);
        const payload =
          parsed.__type === 'workspace_proposal' ? parsed.data : parsed;
        const proposal = (payload as SSEProposalEvent).proposal;

        if (!fileMap.has(proposal.filePath)) {
          fileMap.set(proposal.filePath, {
            filePath: proposal.filePath,
            isContentLoading: false,
            baseContent: null,
            proposalChain: [],
          });
        }

        // Push sequentially. The scroll source guarantees chronological order.
        fileMap.get(proposal.filePath)!.proposalChain.push(proposal);
      } catch (e) {
        this.logger.error('Failed to parse proposal', e);
      }
    }
    return fileMap;
  });

  /**
   * The Query Engine: Calculates the applied state of a file dynamically up to a specific proposal node.
   */
  resolveChainState(
    record: ModifiedFile,
    targetProposalId?: string | null,
  ): ChainResolution {
    let currentText = record.baseContent || ''; // Treat new files as empty strings

    // If asking for base state, and it truly doesn't exist, return null
    if (!targetProposalId && record.baseContent === null)
      return { content: null };

    for (const proposal of record.proposalChain) {
      // Apply the node sequentially
      if (proposal.newContent) {
        currentText = proposal.newContent;
      } else if (proposal.patch) {
        const patchedResult = applyPatch(currentText, proposal.patch);
        if (patchedResult === false) {
          return {
            content: currentText,
            error: `// ERROR: Chain conflict at Proposal ${proposal.id}.\n// The preceding patches did not result in a valid base for this diff.\n\n${proposal.patch}`,
          };
        }
        currentText = patchedResult;
      }

      // Stop once we've reached the user's requested point in time
      if (proposal.id === targetProposalId) {
        break;
      }
    }

    return { content: currentText };
  }

  // --- UI DERIVATIONS ---

  /**
   * Evaluates whether a file has a broken chain.
   * A conflict exists if applying the chronological patches results in an error.
   */
  readonly conflictsMap = computed(() => {
    const conflicts = new Map<string, boolean>();

    this.overlayMap().forEach((record, filePath) => {
      if (record.proposalChain.length === 0) {
        conflicts.set(filePath, false);
        return;
      }

      // Query the engine for the complete chain state (no target ID = process all)
      const resolution = this.resolveChainState(record);

      // If the engine threw a patch error anywhere in the sequence, the chain is conflicted
      conflicts.set(filePath, resolution.error !== undefined);
    });

    return conflicts;
  });

  /**
   * Drift score represents the number of files with committed (accepted) changes
   * that haven't been synced back to the main repository yet.
   */
  readonly driftScore = computed(() => {
    let count = 0;

    this.overlayMap().forEach((record) => {
      // If the chain contains ANY accepted proposals, this file has drifted from base
      const hasAccepted = record.proposalChain.some(
        (p) => p.status === 'accepted',
      );
      if (hasAccepted) {
        count++;
      }
    });

    return count;
  });

  /**
   * Tracks if the workspace needs to be recompiled (e.g., if there are new uncompiled accepted edits)
   * This can be expanded later to check against a build system state.
   */
  readonly requiresRecompile = computed(() => {
    return this.driftScore() > 0;
  });
}
