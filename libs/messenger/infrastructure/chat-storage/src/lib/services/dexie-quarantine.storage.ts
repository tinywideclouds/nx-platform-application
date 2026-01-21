import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  TransportMessage,
} from '@nx-platform-application/messenger-types';
import {
  MessengerDatabase,
  QuarantineMapper,
} from '@nx-platform-application/messenger-infrastructure-db-schema';

import { QuarantineStorage } from '../quarantine.storage';

@Injectable({ providedIn: 'root' })
export class DexieQuarantineStorage implements QuarantineStorage {
  private readonly db = inject(MessengerDatabase);
  private readonly mapper = inject(QuarantineMapper);

  async saveQuarantinedMessage(message: TransportMessage): Promise<void> {
    const record = this.mapper.toRecord(message);
    await this.db.quarantined_messages.put(record);
  }

  async getQuarantinedMessages(senderId: URN): Promise<ChatMessage[]> {
    const records = await this.db.quarantined_messages
      .where('senderId')
      .equals(senderId.toString())
      .sortBy('sentTimestamp');

    return records.map((r) => this.mapper.toDomain(r));
  }

  async getQuarantinedSenders(): Promise<URN[]> {
    const uniqueSenders = await this.db.quarantined_messages
      .orderBy('senderId')
      .uniqueKeys();

    return uniqueSenders.map((k) => URN.parse(k as string));
  }

  async deleteQuarantinedMessages(senderId: URN): Promise<void> {
    await this.db.quarantined_messages
      .where('senderId')
      .equals(senderId.toString())
      .delete();
  }

  async clear(): Promise<void> {
    await this.db.quarantined_messages.clear();
  }
}
