import { Injectable, inject } from '@angular/core';
import { Dexie } from 'dexie';
import { URN } from '@nx-platform-application/platform-types';
import {
  LlmDatabase,
  LlmMessageMapper,
  LlmSessionMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import { LlmMessage, LlmSession } from '@nx-platform-application/llm-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({ providedIn: 'root' })
export class MessageStorageService {
  private db = inject(LlmDatabase);
  private mapper = inject(LlmMessageMapper);
  private sessionMapper = inject(LlmSessionMapper);
  private logger = inject(Logger);

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
    try {
      await this.db.transaction(
        'rw',
        [this.db.messages, this.db.sessions],
        async () => {
          const msgRecord = this.mapper.toRecord(msg);

          // 1. Save the message (Upsert)
          await this.db.messages.put(msgRecord);

          // 2. Safely Upsert the Session
          const existingSession = await this.db.sessions.get(
            msgRecord.sessionId,
          );

          const llmModel =
            existingSession?.llmModel || 'gemini-flash-3-preview';

          if (existingSession) {
            await this.db.sessions.update(msgRecord.sessionId, {
              lastModified: msgRecord.timestamp,
            });
          } else {
            const newSession: LlmSession = {
              id: URN.parse(msgRecord.sessionId),
              title: msgRecord.sessionId,
              llmModel: llmModel,
              lastModified: msgRecord.timestamp as any,
              inlineContexts: [],
              systemContexts: [],
              quickContext: [],
            };

            // Map to record to ensure storage-safe primitives
            const sessionRecord = this.sessionMapper.toRecord(newSession);
            await this.db.sessions.put(sessionRecord);
          }
        },
      );
    } catch (error) {
      // THE ERROR BOUNDARY: Log exactly why IndexedDB failed
      this.logger.error('IndexedDB Put Failure in MessageStorage', {
        errorName: (error as Error).name,
        message: (error as Error).message,
        sessionId: msg.sessionId.toString(),
      });
      throw error; // Re-throw so the UI service knows to show a failure state
    }
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
