import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  LlmDatabase,
  LlmSessionMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import { LlmSession } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class SessionStorageService {
  private db = inject(LlmDatabase);
  private mapper = inject(LlmSessionMapper);

  async saveSession(session: LlmSession): Promise<void> {
    const record = this.mapper.toRecord(session);
    await this.db.sessions.put(record);
  }

  async getSession(id: URN): Promise<LlmSession | undefined> {
    const record = await this.db.sessions.get(id.toString());
    return record ? this.mapper.toDomain(record) : undefined;
  }

  async getSessions(): Promise<LlmSession[]> {
    const records = await this.db.sessions
      .orderBy('lastModified')
      .reverse()
      .toArray();
    return records.map((r) => this.mapper.toDomain(r));
  }

  async deleteSession(id: URN): Promise<void> {
    await this.db.sessions.delete(id.toString());
  }

  async clearAllSessions(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.sessions, this.db.messages],
      async () => {
        await this.db.sessions.clear();
        await this.db.messages.clear();
      },
    );
  }
}
