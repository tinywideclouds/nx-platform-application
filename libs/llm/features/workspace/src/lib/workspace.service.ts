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
  latestContent: string | null;
  activeProposals: SSEProposalEvent['proposal'][];
  acceptedProposals: SSEProposalEvent['proposal'][];
  patchError?: string; // Tracks if a diff failed to apply cleanly
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStateService {
  private readonly logger = inject(Logger);
  private scrollSource = inject(LlmScrollSource);
  private sessionSource = inject(LlmSessionSource);
  private firestoreClient = inject(LlmGithubFirestoreClient);

  // --- INTERNAL STATE ---
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
    // 1. Reactively load lightweight METADATA when session changes
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

    // 2. Auto-Loader: If a file has proposals but no base content, fetch it!
    effect(() => {
      const fileMap = this.overlayMap();
      fileMap.forEach((record, filePath) => {
        const hasProposals =
          record.activeProposals.length > 0 ||
          record.acceptedProposals.length > 0;
        const needsContent =
          record.baseContent === null &&
          !record.isContentLoading &&
          record.metadata;

        if (hasProposals && needsContent) {
          // Untracked to prevent circular effect dependencies
          setTimeout(() => this.loadContent(filePath), 0);
        }
      });
    });
  }

  // --- ACTIONS ---

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

    this.loadingSet.update((set) => {
      const newSet = new Set(set);
      newSet.add(filePath);
      return newSet;
    });

    try {
      const base64Path = this.encodePathForGo(filePath);
      const res = await firstValueFrom(
        this.firestoreClient.getFileContent(cacheId, base64Path),
      );

      this.baseContents.update((map) => {
        const newMap = new Map(map);
        newMap.set(filePath, res.content);
        return newMap;
      });
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

  // --- COMPUTED VFS LOGIC ---

  readonly overlayMap = computed(() => {
    const fileMap = new Map<string, ModifiedFile>();
    const messages = this.sessionMessages();
    const metaTree = this.baseMetadata();
    const contents = this.baseContents();
    const loading = this.loadingSet();

    // 1. Initialize map
    metaTree.forEach((meta, filePath) => {
      const content = contents.get(filePath) || null;
      fileMap.set(filePath, {
        filePath,
        metadata: meta,
        isContentLoading: loading.has(filePath),
        baseContent: content,
        latestContent: content,
        activeProposals: [],
        acceptedProposals: [],
      });
    });

    // 2. Chronological Patch Application
    const decoder = new TextDecoder();

    for (const msg of messages) {
      if (!msg.payloadBytes || !msg.typeId.equals(FileProposalType)) continue;

      try {
        const text = decoder.decode(msg.payloadBytes);
        const parsed = JSON.parse(text);
        const payload =
          parsed.__type === 'workspace_proposal' ? parsed.data : parsed;
        const proposal = (payload as SSEProposalEvent).proposal;
        const filePath = proposal.filePath;

        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, {
            filePath,
            isContentLoading: false,
            baseContent: null,
            latestContent: '', // Treat new files as empty strings for patching
            activeProposals: [],
            acceptedProposals: [],
          });
        }

        const fileRecord = fileMap.get(filePath)!;

        if (proposal.status === 'accepted') {
          fileRecord.acceptedProposals.push(proposal);

          if (proposal.newContent) {
            // Absolute overwrite
            fileRecord.latestContent = proposal.newContent;
            fileRecord.patchError = undefined;
          } else if (proposal.patch) {
            // Sequential diff application
            const currentText = fileRecord.latestContent;

            if (currentText !== null) {
              const patchedResult = applyPatch(currentText, proposal.patch);

              if (patchedResult === false) {
                fileRecord.patchError = `Failed to apply patch sequence cleanly.`;
                this.logger.warn(`Patch conflict on ${filePath}`);
              } else {
                fileRecord.latestContent = patchedResult;
                fileRecord.patchError = undefined;
              }
            }
            // If currentText is null, we do nothing. The auto-loader will fetch it,
            // and this computed signal will re-run once the base text arrives!
          }
        } else if (proposal.status === 'pending') {
          fileRecord.activeProposals.push(proposal);
        }
      } catch (e) {
        this.logger.error('Failed to parse or patch proposal', e);
      }
    }

    return fileMap;
  });

  // --- UI DERIVATIONS ---

  readonly conflictsMap = computed(() => {
    const conflicts = new Map<string, boolean>();
    this.overlayMap().forEach((record, filePath) => {
      conflicts.set(filePath, record.activeProposals.length > 1);
    });
    return conflicts;
  });

  readonly driftScore = computed(() => {
    let count = 0;
    this.overlayMap().forEach((r) => {
      if (r.acceptedProposals.length > 0) count++;
    });
    return count;
  });

  readonly requiresRecompile = computed(() => this.driftScore() >= 5);
}
