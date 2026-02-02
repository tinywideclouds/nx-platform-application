import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

import { ScenarioScript, ScriptAction, ScenarioItem } from '../types';
import { MockLiveService } from '../services/mock-live.service';

// ✅ WORLD SERVICES (The Abstraction Layer)
import { WorldMessagingService } from '../world/world-messaging.service';
import {
  WorldInboxService,
  WorldInboxMessage,
} from '../world/world-inbox.service';
import { Temporal } from '@js-temporal/polyfill';
import { IdentitySetupService } from '../world/identity-setup.service';

@Injectable({ providedIn: 'root' })
export class ScenarioDirectorService {
  private logger = inject(Logger).withPrefix('[Mock:Director]');

  private liveService = inject(MockLiveService);

  private identitySetup = inject(IdentitySetupService);

  // OUTPUT: Sends messages FROM the world TO the app
  private worldMessaging = inject(WorldMessagingService);

  // INPUT: Listens to messages FROM the app TO the world (Decrypted)
  private worldInbox = inject(WorldInboxService);

  private activeScript: ScenarioScript | null = null;

  constructor() {
    this.initializeListener();
  }

  loadScript(script?: ScenarioScript) {
    this.activeScript = script || null;
    if (this.activeScript) {
      this.logger.info(
        `🎬 Script loaded with ${this.activeScript.rules.length} rules.`,
      );
    }
  }

  private initializeListener() {
    // 👂 LISTEN: We subscribe to the decrypted stream from the World Inbox
    this.worldInbox.messages$.subscribe((msg) => {
      this.evaluateEvent('outbound_message', msg);
    });
  }

  private evaluateEvent(eventType: string, msg: WorldInboxMessage) {
    if (!this.activeScript) return;

    for (const rule of this.activeScript.rules) {
      if (rule.on !== eventType) continue;

      if (this.checkMatch(rule.match, msg)) {
        this.logger.info(
          `✅ Rule Matched! Scheduling ${rule.actions.length} actions.`,
        );
        // Pass the TRIGGER MESSAGE to the action executor
        this.executeActions(rule.actions, msg);
      }
    }
  }

  private checkMatch(match: any, msg: WorldInboxMessage): boolean {
    // 1. Match Recipient
    // 1. Match Recipient (Smart Match)
    if (match.recipientId) {
      // The message has the ROUTER URN (urn:lookup:email:...)
      // The rule has the CONTACT URN (urn:contacts:user:...)
      const isMatch = this.identitySetup.isSameIdentity(
        match.recipientId,
        msg.recipientId,
      );

      if (!isMatch) return false;
    }

    const isSignal = msg.content.kind === 'signal';

    if (match.isEphemeral !== undefined) {
      // Strict Mode: Rule explicitly asks for signals (true) or content (false)
      if (match.isEphemeral !== isSignal) return false;
    } else {
      // Default Mode: If rule doesn't specify, we IGNORE signals.
      // We assume you want to reply to text/images, not typing indicators.
      if (isSignal) return false;
    }

    // 2. Match Text Content
    if (match.textContains) {
      if (
        msg.content.kind === 'content' &&
        msg.content.payload.kind === 'text'
      ) {
        if (!msg.content.payload.text.includes(match.textContains)) {
          return false;
        }
      } else {
        return false;
      }
    }

    // 4. ✅ NEW: Payload Kind Match
    if (match.payloadKind) {
      let kind = '';
      if (msg.content.kind === 'content') {
        kind = msg.content.payload.kind;
      } else if (msg.content.kind === 'signal') {
        kind = msg.content.payload.action;
      }

      if (kind !== match.payloadKind) {
        return false;
      }
    }

    return true;
  }

  private executeActions(
    actions: ScriptAction[],
    triggerMsg: WorldInboxMessage,
  ) {
    actions.forEach((action) => {
      setTimeout(() => {
        this.executeAction(action, triggerMsg);
      }, action.delayMs);
    });
  }

  private async executeAction(
    action: ScriptAction,
    triggerMsg: WorldInboxMessage,
  ) {
    const now = Temporal.Now.instant();
    const identityUrn = this.identitySetup.resolveNetworkHandle(
      triggerMsg.recipientId,
    );

    this.logger.info(`⚡ Executing Action: ${action.type}`, identityUrn);

    try {
      // ✅ CASE 1: Accept Group Invite
      if (action.type === 'accept_group_invite') {
        // Inspect Trigger Message for Group ID
        if (
          triggerMsg.content.kind === 'content' &&
          triggerMsg.content.payload.kind === 'group-invite'
        ) {
          const inviteData = triggerMsg.content.payload.data;
          const groupUrn = URN.parse(inviteData.groupUrn);

          await this.worldMessaging.deliverGroupJoinResponse(
            identityUrn,
            groupUrn,
            'joined',
          );

          this.liveService.trigger(); // Wake up app
          return;
        } else {
          this.logger.warn(
            '⚠️ Cannot accept invite: Trigger was not a group-invite',
          );
          return;
        }
      }

      // ✅ CASE 2: Standard Text/Signal Reply
      let payload = action.payload;

      if (action.type === 'send_typing_indicator' && !payload) {
        payload = { action: 'typing', data: null };
      }
      if (action.type === 'send_read_receipt' && !payload) {
        payload = {
          action: 'read-receipt',
          data: {
            messageIds: [triggerMsg.transportId || 'mock-id'],
            readAt: now.toString(),
          },
        };
      }

      if (action.type === 'send_delivery_receipt' && !payload) {
        payload = {
          action: 'delivery-receipt', // Signals "Delivered" status to the App
          data: {
            messageIds: [triggerMsg.transportId || 'mock-id'],
            // Reuse 'readAt' as the generic timestamp field
            // (since DeliveryReceiptData doesn't exist in your domain)
            readAt: now.toString(),
          },
        };
      }

      if (!payload) return;

      const item: ScenarioItem = {
        id: `reply-${now.epochMilliseconds}`,
        senderUrn: identityUrn,
        sentAt: now.toString() as ISODateTimeString,
        status: 'sent',
        payload: payload,
      };

      await this.worldMessaging.deliverMessage(item);
      this.liveService.trigger();
    } catch (err) {
      this.logger.error('Failed to execute script action', err);
    }
  }
}
