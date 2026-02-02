import { Injectable } from '@angular/core';
import {
  SendStrategy,
  SendContext,
  OutboundTarget,
} from '../send-strategy.interface';

@Injectable({ providedIn: 'root' })
export class DirectSendStrategy implements SendStrategy {
  async getTargets(ctx: SendContext): Promise<OutboundTarget[]> {
    // Pure Routing: Direct messages go to the recipient, in the recipient's context.
    return [
      {
        conversationUrn: ctx.recipientUrn,
        recipients: [ctx.recipientUrn],
      },
    ];
  }
}
