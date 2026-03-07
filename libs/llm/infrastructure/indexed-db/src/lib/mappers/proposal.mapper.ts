import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ProposalRecord } from '../records/proposal.record';
import {
  RegistryEntry,
  ProposalStatus,
} from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class ProposalMapper {
  toDomain(record: ProposalRecord): RegistryEntry {
    return {
      id: URN.parse(record.id),
      ownerSessionId: URN.parse(record.ownerSessionId),
      filePath: record.filePath,
      patch: record.patch,
      newContent: record.newContent,
      reasoning: record.reasoning,
      status: record.status as ProposalStatus,
      createdAt: record.createdAt,
    };
  }

  toRecord(domain: RegistryEntry): ProposalRecord {
    return {
      id: domain.id.toString(),
      ownerSessionId: domain.ownerSessionId.toString(),
      filePath: domain.filePath,
      patch: domain.patch,
      newContent: domain.newContent,
      reasoning: domain.reasoning,
      status: domain.status || 'pending',
      createdAt: domain.createdAt,
    };
  }
}
