import { Conversation } from '@nx-platform-application/messenger-types';
import { Temporal } from '@js-temporal/polyfill';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

export class ChatMergeStrategy {
  static merge(local: Conversation | null, remote: Conversation): Conversation {
    if (!local) {
      return remote;
    }

    // GENESIS RULE: The true start of the conversation is the oldest date we know of.
    // If local thinks it started today, but remote says it started last year, remote wins.
    const mergedGenesis = this.pickEarliest(
      local.genesisTimestamp,
      remote.genesisTimestamp,
    );

    // MUTABLE RULE: Last Write Wins for content (snippet, unreadCount, etc)
    const localTime = Temporal.Instant.from(local.lastModified);
    const remoteTime = Temporal.Instant.from(remote.lastModified);

    // If Remote is newer (or equal), it wins the mutable fields.
    if (Temporal.Instant.compare(remoteTime, localTime) >= 0) {
      return {
        ...remote,
        genesisTimestamp: mergedGenesis,
      };
    }

    // If Local is newer, it keeps its mutable fields.
    return {
      ...local,
      genesisTimestamp: mergedGenesis,
    };
  }

  private static pickEarliest(
    a: ISODateTimeString | null,
    b: ISODateTimeString | null,
  ): ISODateTimeString | null {
    if (!a) return b;
    if (!b) return a;

    const tA = Temporal.Instant.from(a);
    const tB = Temporal.Instant.from(b);

    return Temporal.Instant.compare(tA, tB) <= 0 ? a : b;
  }
}
