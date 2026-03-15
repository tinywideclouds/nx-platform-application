import { Injectable, inject, signal } from '@angular/core';
import {
  ProposalRegistryStorageService,
  MessageStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import {
  ChangeProposal,
  RegistryEntry,
} from '@nx-platform-application/llm-types';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({ providedIn: 'root' })
export class LlmProposalService {
  private registry = inject(ProposalRegistryStorageService);
  private storage = inject(MessageStorageService);
  private network = inject(LLM_NETWORK_CLIENT);
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

    for (const idStr of proposalIds) {
      try {
        const urn = URN.parse(idStr);
        const proposal = await this.registry.getProposal(urn);

        if (proposal) {
          const ownerStr = proposal.ownerSessionId.toString();

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

    // Tick the global heartbeat for the Workspace Engine and Scroll Source
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
        await this.registry.saveProposal({
          ...proposal,
          patch: healedPatch,
        });

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
