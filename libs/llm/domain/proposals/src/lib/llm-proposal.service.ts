import { Injectable, inject, signal } from '@angular/core';
import {
  ProposalRegistryStorageService,
  MessageStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { LlmScrollSource } from '@nx-platform-application/llm-features-chat';
import {
  ChangeProposal,
  RegistryEntry,
  FileLinkType,
  PointerPayload,
} from '@nx-platform-application/llm-types';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({ providedIn: 'root' })
export class LlmProposalService {
  private registry = inject(ProposalRegistryStorageService);
  private storage = inject(MessageStorageService);
  private network = inject(LLM_NETWORK_CLIENT);
  private sink = inject(LlmScrollSource);
  private logger = inject(Logger);

  readonly registryMutated = signal<number>(0);

  async saveChangeProposal(
    sessionId: URN,
    entryId: URN,
    p: ChangeProposal,
  ): Promise<void> {
    const registryEntry: RegistryEntry = {
      id: entryId,
      ownerSessionId: sessionId,
      filePath: p.filePath,
      patch: p.patch,
      newContent: p.newContent,
      reasoning: p.reasoning,
      status: 'pending',
      createdAt: p.createdAt,
    };

    this.saveProposal(registryEntry);
  }

  async saveProposal(entry: RegistryEntry): Promise<void> {
    await this.registry.saveProposal(entry);
    this.pingMutation();
  }

  async getProposalsForSession(sessionId: URN): Promise<RegistryEntry[]> {
    return this.registry.getProposalsForSession(sessionId);
  }

  async getProposal(id: URN): Promise<RegistryEntry | null> {
    return this.registry.getProposal(id);
  }

  // --- REFACTORED: NO LONGER TAKES sessionId FROM THE UI ---
  async acceptProposal(proposalId: string): Promise<void> {
    await this.updateProposalStatuses([proposalId], 'accepted');
  }

  async rejectProposal(proposalId: string): Promise<void> {
    await this.updateProposalStatuses([proposalId], 'rejected');
  }

  async updateProposalStatuses(
    proposalIds: string[],
    newStatus: 'pending' | 'staged' | 'accepted' | 'rejected',
  ): Promise<void> {
    if (!proposalIds.length) return;

    // 1. Group proposals by their TRUE owner session
    const sessionMap = new Map<string, string[]>();

    for (const idStr of proposalIds) {
      try {
        const urn = URN.parse(idStr);
        const proposal = await this.registry.getProposal(urn);

        if (proposal) {
          const ownerStr = proposal.ownerSessionId.toString();
          if (!sessionMap.has(ownerStr)) sessionMap.set(ownerStr, []);
          sessionMap.get(ownerStr)!.push(idStr);

          // Update the Single Source of Truth immediately
          await this.registry.updateStatus(urn, newStatus);

          // If finalizing, clear the network queue using the CORRECT owner session
          if (newStatus === 'accepted' || newStatus === 'rejected') {
            await this.network.removeProposal(ownerStr, idStr);
          }
        }
      } catch (e) {
        this.logger.error(`Failed to update status for proposal ${idStr}`, e);
      }
    }

    // 2. Reactivity Nudges for the Chat UI
    const activeChatId = this.sink.activeSessionId()?.toString();

    // We only need to nudge the UI if the current chat window owns the proposals we just changed.
    if (activeChatId && sessionMap.has(activeChatId)) {
      const activeIdsToNudge = new Set(sessionMap.get(activeChatId));
      const messages = await this.storage.getSessionMessages(
        URN.parse(activeChatId),
      );
      const decoder = new TextDecoder();

      for (const msg of messages) {
        if (msg.payloadBytes && msg.typeId.equals(FileLinkType)) {
          const text = decoder.decode(msg.payloadBytes);
          const pointer = JSON.parse(text) as PointerPayload;
          const ptrStr = pointer.proposalId as unknown as string;

          if (activeIdsToNudge.has(ptrStr)) {
            // Nudge the sink to force the file-link-bubble to re-render
            this.sink.updateMessagePayload(msg.id, msg.payloadBytes);
          }
        }
      }
    }

    // Tick the global heartbeat for the Workspace Engine
    this.pingMutation();
  }

  async healProposalPatch(
    proposalId: string,
    healedPatch: string,
  ): Promise<void> {
    try {
      const id = URN.parse(proposalId);
      const proposal = await this.registry.getProposal(id);

      if (proposal) {
        // 1. Update the local DB with the corrected patch
        await this.registry.saveProposal({
          ...proposal,
          patch: healedPatch,
        });

        // 2. Tell the Go backend to replace the patch in its memory/context
        // Assuming your network client has or will have an update/fix endpoint
        // await this.network.updateProposalPatch(proposal.ownerSessionId.toString(), proposalId, healedPatch);

        // 3. Trigger Workspace re-render
        this.pingMutation();
      }
    } catch (e) {
      this.logger.error(`Failed to heal proposal ${proposalId}`, e);
    }
  }

  private pingMutation() {
    this.registryMutated.update((v) => v + 1);
  }
}
