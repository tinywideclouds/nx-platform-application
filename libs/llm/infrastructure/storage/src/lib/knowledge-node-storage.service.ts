import { Injectable, inject } from '@angular/core';
import { Dexie } from 'dexie';
import { URN } from '@nx-platform-application/platform-types';
import {
  LlmDatabase,
  LlmKnowledgeNodeMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import { LlmKnowledgeNode } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class KnowledgeNodeStorageService {
  private db = inject(LlmDatabase);
  private mapper = inject(LlmKnowledgeNodeMapper);

  async saveNode(node: LlmKnowledgeNode): Promise<void> {
    const record = this.mapper.toRecord(node);
    await this.db.knowledgeNodes.put(record);
  }

  async getSessionNodes(sessionId: URN): Promise<LlmKnowledgeNode[]> {
    const records = await this.db.knowledgeNodes
      .where('sessionId')
      .equals(sessionId.toString())
      .toArray();

    return records.map((r) => this.mapper.toDomain(r));
  }

  // Useful for finding specific architectural decisions
  async getNodesByType(
    sessionId: URN,
    typeId: URN,
  ): Promise<LlmKnowledgeNode[]> {
    const records = await this.db.knowledgeNodes
      .where('sessionId')
      .equals(sessionId.toString())
      .and(
        (record) =>
          record.typeId === typeId.toString() && record.status === 'active',
      )
      .toArray();

    return records.map((r) => this.mapper.toDomain(r));
  }

  async deleteNode(id: URN): Promise<void> {
    await this.db.knowledgeNodes.delete(id.toString());
  }
}
