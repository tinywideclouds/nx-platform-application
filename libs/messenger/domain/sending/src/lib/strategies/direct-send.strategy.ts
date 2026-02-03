import { Injectable, inject } from '@angular/core';
import {
  SendStrategy,
  SendContext,
  OutboundTarget,
} from '../send-strategy.interface';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';

@Injectable({ providedIn: 'root' })
export class DirectSendStrategy implements SendStrategy {
  async getTargets(ctx: SendContext): Promise<OutboundTarget[]> {
    // Pure Routing: Direct messages go to the recipient, in the recipient's context.
    return [
      {
        conversationUrn: ctx.conversationUrn,
        recipients: [ctx.recipientUrn],
      },
    ];
  }
}
