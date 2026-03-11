import { Injectable, inject } from '@angular/core';
import { Dexie } from 'dexie';
import { URN } from '@nx-platform-application/platform-types';
import {
  LlmDatabase,
  LlmMessageMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import { LlmMessage } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class MessageStorageService {
  private db = inject(LlmDatabase);
  private mapper = inject(LlmMessageMapper);

  async getMessage(id: URN): Promise<LlmMessage | undefined> {
    const record = await this.db.messages.get(id.toString());
    return record ? this.mapper.toDomain(record) : undefined;
  }

  async getSessionMessages(sessionId: URN): Promise<LlmMessage[]> {
    const idStr = sessionId.toString();
    const records = await this.db.messages
      .where('[sessionId+timestamp]')
      .between([idStr, Dexie.minKey], [idStr, Dexie.maxKey])
      .toArray();

    return records.map((r) => this.mapper.toDomain(r));
  }

  async saveMessage(msg: LlmMessage): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.sessions],
      async () => {
        const msgRecord = this.mapper.toRecord(msg);

        // 1. Save the message (Upsert)
        await this.db.messages.put(msgRecord);

        // 2. Safely Upsert the Session
        const existingSession = await this.db.sessions.get(msgRecord.sessionId);

        if (existingSession) {
          await this.db.sessions.update(msgRecord.sessionId, {
            lastModified: msgRecord.timestamp,
          });
        } else {
          // FIX: Align with new LlmSessionRecord schema
          await this.db.sessions.put({
            id: msgRecord.sessionId,
            title: msgRecord.sessionId.toString(),
            lastModified: msgRecord.timestamp,
            // Initialize the new explicit intent buckets
            inlineContexts: [],
            systemContexts: [],
            compiledContext: undefined,
            quickContext: [],
          });
        }
      },
    );
  }

  async bulkSaveMessages(msgs: LlmMessage[]): Promise<void> {
    const records = msgs.map((m) => this.mapper.toRecord(m));
    await this.db.messages.bulkPut(records);
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
}
