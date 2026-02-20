import { Injectable, inject } from '@angular/core';
import { Dexie } from 'dexie';
import { URN } from '@nx-platform-application/platform-types';
import {
  LlmDatabase,
  LlmMessageMapper,
  LlmSessionMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import { LlmSession, LlmMessage } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class LlmStorageService {
  private db = inject(LlmDatabase);
  private sessionMapper = inject(LlmSessionMapper);
  private messageMapper = inject(LlmMessageMapper);

  // --- WRITE ---

  async saveSession(session: LlmSession): Promise<void> {
    const record = this.sessionMapper.toRecord(session);
    await this.db.sessions.put(record);
  }

  async getMessage(id: URN): Promise<LlmMessage | undefined> {
    const record = await this.db.messages.get(id.toString());
    return record ? this.messageMapper.toDomain(record) : undefined;
  }

  async saveMessage(msg: LlmMessage): Promise<void> {
    // Transaction ensures session 'lastModified' stays in sync with latest message
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.sessions],
      async () => {
        const msgRecord = this.messageMapper.toRecord(msg);

        // 1. Save the message (Upsert)
        await this.db.messages.put(msgRecord);

        // 2. Safely Upsert the Session
        const existingSession = await this.db.sessions.get(msgRecord.sessionId);

        if (existingSession) {
          // It's an existing chat, just bump the timestamp
          await this.db.sessions.update(msgRecord.sessionId, {
            lastModified: msgRecord.timestamp,
          });
        } else {
          // It's a brand NEW chat! Create the session record.
          // Note: Adjust the fields below if your LlmSessionRecord has other required properties
          await this.db.sessions.put({
            id: msgRecord.sessionId,
            title: msgRecord.sessionId.toString(), // Default title is the session ID, can be updated later
            lastModified: msgRecord.timestamp,
            contextGroups: {}, // Initialize the empty dictionary
          });
        }
      },
    );
  }

  async bulkSaveMessages(msgs: LlmMessage[]): Promise<void> {
    const records = msgs.map((m) => this.messageMapper.toRecord(m));
    await this.db.messages.bulkPut(records);
  }

  // --- READ ---

  async getSession(id: URN): Promise<LlmSession | undefined> {
    const record = await this.db.sessions.get(id.toString());
    return record ? this.sessionMapper.toDomain(record) : undefined;
  }

  async getSessions(): Promise<LlmSession[]> {
    const records = await this.db.sessions
      .orderBy('lastModified')
      .reverse()
      .toArray();
    return records.map((r) => this.sessionMapper.toDomain(r));
  }

  /**
   * Retrieves messages for a specific session.
   * Uses the compound index [sessionId+timestamp] for performance.
   */
  async getSessionMessages(sessionId: URN): Promise<LlmMessage[]> {
    const idStr = sessionId.toString();
    const records = await this.db.messages
      .where('[sessionId+timestamp]')
      .between([idStr, Dexie.minKey], [idStr, Dexie.maxKey])
      .toArray();

    return records.map((r) => this.messageMapper.toDomain(r));
  }

  async deleteMessages(ids: URN[]): Promise<void> {
    const idStrings = ids.map((id) => id.toString());
    await this.db.messages.bulkDelete(idStrings);
  }

  async updateMessageExclusions(
    ids: URN[],
    isExcluded: boolean,
  ): Promise<void> {
    const idStrings = ids.map((id) => id.toString());

    // Perform updates in a single transaction
    await this.db.transaction('rw', this.db.messages, async () => {
      for (const idStr of idStrings) {
        const record = await this.db.messages.get(idStr);
        if (record) {
          record.isExcluded = isExcluded;
          await this.db.messages.put(record);
        }
      }
    });
  }

  // --- MAINTENANCE ---

  async clearDatabase(): Promise<void> {
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
