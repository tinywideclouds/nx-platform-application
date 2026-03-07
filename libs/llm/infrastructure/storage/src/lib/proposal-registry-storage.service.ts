import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  RegistryEntry,
  ProposalStatus,
} from '@nx-platform-application/llm-types';
import {
  LlmDatabase,
  ProposalMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';

/**
 * @SOT SINGLE SOURCE OF TRUTH: File State & Diff Patches
 *
 * This registry is the canonical source of truth for all file proposals,
 * their heavy diff patches, and their current mutation status.
 * Chat messages (LlmMessage) MUST NOT dictate the status of a proposal;
 * they should only act as lightweight UI pointers to this database.
 */
@Injectable({ providedIn: 'root' })
export class ProposalRegistryStorageService {
  private db = inject(LlmDatabase);
  private mapper = inject(ProposalMapper);

  async saveProposal(entry: RegistryEntry): Promise<void> {
    const record = this.mapper.toRecord(entry);
    await this.db.proposals.put(record);
  }

  // async updateStatus(id: URN, status: ProposalStatus): Promise<void> {
  //   const idStr = id.toString();
  //   const record = await this.db.proposals.get(idStr);

  //   if (!record) {
  //     throw new Error(`Proposal with id ${idStr} not found.`);
  //   }

  //   record.status = status || 'pending';
  //   await this.db.proposals.put(record);
  // }

  async updateStatus(id: URN, status: ProposalStatus): Promise<void> {
    await this.db.proposals.update(id.toString(), { status });
  }

  async getProposal(id: URN): Promise<RegistryEntry | null> {
    const record = await this.db.proposals.get(id.toString());
    return record ? this.mapper.toDomain(record) : null;
  }

  async getProposalsForFile(filePath: string): Promise<RegistryEntry[]> {
    const records = await this.db.proposals
      .where('filePath')
      .equals(filePath)
      .toArray();

    return records.map((r) => this.mapper.toDomain(r));
  }

  async getProposalsForSession(ownerSessionId: URN): Promise<RegistryEntry[]> {
    const records = await this.db.proposals
      .where('ownerSessionId')
      .equals(ownerSessionId.toString())
      .toArray();

    return records.map((r) => this.mapper.toDomain(r));
  }
}
