import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';

import { ScenarioScript, ScriptAction, ScenarioItem } from '../types';
import { MockLiveService } from '../services/mock-live.service';

// ✅ WORLD SERVICES (The Abstraction Layer)
import { WorldMessagingService } from '../world/world-messaging.service';
import {
  WorldInboxService,
  WorldInboxMessage,
} from '../world/world-inbox.service';
import { Temporal } from '@js-temporal/polyfill';

@Injectable({ providedIn: 'root' })
export class ScenarioDirectorService {
  private logger = inject(Logger).withPrefix('[Mock:Director]');

  private liveService = inject(MockLiveService);

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

      // 🔍 MATCH: We check the Decrypted Content
      if (this.checkMatch(rule.match, msg)) {
        this.logger.info(
          `✅ Rule Matched! Scheduling ${rule.actions.length} actions.`,
        );
        this.executeActions(rule.actions, msg.recipientId, msg.transportId);
      }
    }
  }

  private checkMatch(match: any, msg: WorldInboxMessage): boolean {
    // 1. Match Recipient
    if (match.recipientId && !match.recipientId.equals(msg.recipientId)) {
      return false;
    }

    // ✅ FIX: Filter out Signals by default
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

    return true;
  }

  private executeActions(
    actions: ScriptAction[],
    partnerUrn: URN,
    messageId?: string,
  ) {
    actions.forEach((action) => {
      setTimeout(() => {
        this.executeAction(action, partnerUrn, messageId);
      }, action.delayMs);
    });
  }

  private async executeAction(
    action: ScriptAction,
    partnerUrn: URN,
    messageId?: string,
  ) {
    const now = Temporal.Now.instant();
    this.logger.info(
      `⚡ Executing Action: ${action.type} at ${now.toString()}`,
    );

    try {
      let payload = action.payload;

      if (action.type === 'send_typing_indicator' && !payload) {
        payload = { action: 'typing', data: null };
      }

      const receiptIds = ['mock-ack-id'];
      if (messageId) {
        receiptIds.push(messageId);
      }
      // Special handling for Read Receipts (simulate dynamic ID reference)
      // Since we don't track exact message IDs in this simple script, we use a placeholder.
      if (action.type === 'send_read_receipt' && !payload) {
        payload = {
          action: 'read-receipt',
          data: {
            messageIds: receiptIds,
            readAt: now.toString(),
          },
        };
      }

      if (!payload) {
        this.logger.warn('action has no payload returning');
        return;
      }

      // 1. CONSTRUCT INTENT
      // "Alice wants to reply"
      const item: ScenarioItem = {
        id: `reply-${now.toZonedDateTimeISO('Europe/Paris')}`,
        senderUrn: partnerUrn, // The reply comes FROM the person we just messaged
        sentAt: now.toString(),
        status: 'sent',
        payload: payload,
      };

      // 2. COMMAND WORLD TO DELIVER
      // The World Service handles encryption, keys, and network injection.
      await this.worldMessaging.deliverMessage(item);

      // 3. WAKE UP APP
      // Notify the app that new data is available in the mock queue.
      this.liveService.trigger();
    } catch (err) {
      this.logger.error('Failed to execute script action', err);
    }
  }
}
