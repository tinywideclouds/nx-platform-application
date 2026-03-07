import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-infrastructure-indexed-db';
import { LlmMessageRecord } from './records/message.record';
import { LlmSessionRecord } from './records/session.record';
import { ProposalRecord } from './records/proposal.record';

@Injectable({ providedIn: 'root' })
export class LlmDatabase extends PlatformDexieService {
  sessions!: Table<LlmSessionRecord, string>;
  messages!: Table<LlmMessageRecord, string>;
  proposals!: Table<ProposalRecord, string>;

  constructor() {
    super('llm_client');

    this.version(3).stores({
      sessions: 'id, lastModified',
      // We index sessionId+timestamp for fast history paging
      messages: 'id, sessionId, timestamp, [sessionId+timestamp], *tags',
      // We index ownerSessionId and filePath for fast cross-session workspace aggregation
      proposals: 'id, ownerSessionId, filePath, [ownerSessionId+filePath]',
    });

    this.sessions = this.table('sessions');
    this.messages = this.table('messages');
    this.proposals = this.table('proposals');
  }
}
