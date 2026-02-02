import { Injectable } from '@angular/core';
import {
  SendStrategy,
  SendContext,
  OutboundTarget,
} from '../send-strategy.interface';

@Injectable({ providedIn: 'root' })
export class BroadcastStrategy implements SendStrategy {
  async getTargets(ctx: SendContext): Promise<OutboundTarget[]> {
    const { recipients } = ctx;

    // STRICT: If no explicit recipients, this strategy does nothing.
    if (!recipients || recipients.length === 0) {
      return [];
    }

    // Client-Side Fan-Out:
    // We create N targets. Each target uses the Recipient as the Conversation URN
    // (creating N separate 1:1 messages).
    return recipients.map((urn) => ({
      conversationUrn: urn,
      recipients: [urn],
    }));
  }
}
