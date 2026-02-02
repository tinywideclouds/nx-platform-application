import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { DirectoryQueryApi } from '@nx-platform-application/directory-api';
import {
  SendStrategy,
  SendContext,
  OutboundTarget,
} from '../send-strategy.interface';

const MAX_EPHEMERAL_FANOUT = 5;

@Injectable({ providedIn: 'root' })
export class NetworkGroupStrategy implements SendStrategy {
  private logger = inject(Logger);
  private directoryApi = inject(DirectoryQueryApi);

  async getTargets(ctx: SendContext): Promise<OutboundTarget[]> {
    const { recipientUrn, isEphemeral } = ctx;

    // 1. Resolve Members via Directory API
    const group = await this.directoryApi.getGroup(recipientUrn);
    const members = group?.members || [];

    // 2. Policy: Ephemeral Fan-out Limit
    // If too big, we return EMPTY list. Service sees empty list -> Sends nothing -> Success.
    if (isEphemeral && members.length > MAX_EPHEMERAL_FANOUT) {
      this.logger.warn(
        '[NetworkGroup] Skipping ephemeral fanout: too many members',
        {
          count: members.length,
          limit: MAX_EPHEMERAL_FANOUT,
        },
      );
      return [];
    }

    // 3. Return 1 Target with Many Recipients (Batch)
    // The Service will map this to a single Outbox Entry or Worker Batch
    return [
      {
        conversationUrn: recipientUrn,
        recipients: members.map((m) => m.id),
      },
    ];
  }
}
