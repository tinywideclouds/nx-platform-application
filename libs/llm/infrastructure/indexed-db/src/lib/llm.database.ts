import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-infrastructure-indexed-db';
import { LlmMessageRecord } from './records/message.record';
import { LlmSessionRecord } from './records/session.record';
import { ProposalRecord } from './records/proposal.record';
import { CompiledCacheRecord } from './records/compiled-cache.record';
import {
  LlmMemoryDigestRecord,
  LlmKnowledgeNodeRecord,
} from './records/memory.record';

@Injectable({ providedIn: 'root' })
export class LlmDatabase extends PlatformDexieService {
  sessions!: Table<LlmSessionRecord, string>;
  messages!: Table<LlmMessageRecord, string>;
  proposals!: Table<ProposalRecord, string>;
  compiledCaches!: Table<CompiledCacheRecord, string>;
  digests!: Table<LlmMemoryDigestRecord, string>;
  knowledgeNodes!: Table<LlmKnowledgeNodeRecord, string>;

  constructor() {
    super('llm_client');

    this.version(8).stores({
      sessions: 'id, lastModified',
      messages: 'id, sessionId, timestamp, [sessionId+timestamp], *tags',
      proposals: 'id, ownerSessionId, filePath, [ownerSessionId+filePath]',
      compiledCaches: 'id, expiresAt',
      digests:
        'id, sessionId, typeId, createdAt, startTime, endTime, [sessionId+createdAt], *registryEntities',
      knowledgeNodes:
        'id, sessionId, typeId, status, updatedAt, [sessionId+status], *registryEntities, *linkedNodes',
    });

    this.sessions = this.table('sessions');
    this.messages = this.table('messages');
    this.proposals = this.table('proposals');
    this.compiledCaches = this.table('compiledCaches');
    this.digests = this.table('digests');
    this.knowledgeNodes = this.table('knowledgeNodes');
  }
}
