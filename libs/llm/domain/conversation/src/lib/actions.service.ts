import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  LlmMessage,
  LlmSession,
  SSEProposalEvent,
  TextType,
} from '@nx-platform-application/llm-types';
import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { LlmContextBuilderService } from './context-builder.service';

const encoder = new TextEncoder();

@Injectable({ providedIn: 'root' })
export class LlmChatActions {
  private readonly logger = inject(Logger);
  private sink = inject(LlmScrollSource);
  private sessionSource = inject(LlmSessionSource);
  private storage = inject(LlmStorageService);
  private network = inject(LLM_NETWORK_CLIENT);
  private contextBuilder = inject(LlmContextBuilderService);

  // Cancellation & State Tracking
  private activeSubscription: Subscription | null = null;
  private activeBotId: URN | null = null;
  private accumulatedText = '';
  private activeBotMsg: LlmMessage | null = null;

  // State for the UI to bind the Diff Viewer to
  readonly activeProposal = signal<SSEProposalEvent | null>(null);

  /**
   * The Full "Chat Loop":
   * 1. User Message (Sink + DB) -> AWAITED!
   * 2. Bot Placeholder (Sink + DB) -> AWAITED!
   * 3. Assemble Context (Reads synced DB)
   * 4. Network Stream -> Updates Placeholder (Sink)
   * 5. Stream Complete -> Save final payload (DB)
   */
  async sendMessage(text: string, sessionId: URN): Promise<void> {
    const idStr = sessionId.toString();
    const session = this.sessionSource
      .sessions()
      .find((s) => s.id.toString() === idStr);

    if (!session) {
      this.logger.error(`Session ${idStr} not found`);
      return;
    }

    this.sink.setLoading(true);
    const now = Temporal.Now.instant();

    // --- STEP 1: USER MESSAGE ---
    const userMsgId = URN.create('message', crypto.randomUUID(), 'llm');
    const userMsg: LlmMessage = {
      id: userMsgId,
      typeId: TextType,
      sessionId: sessionId,
      role: 'user',
      timestamp: now.toString() as ISODateTimeString,
      payloadBytes: encoder.encode(text),
      isExcluded: false,
    };

    await this.storage.saveMessage(userMsg);
    this.sink.addMessage(userMsg);

    // --- STEP 2: ASSEMBLE CONTEXT (PRISTINE DB STATE) ---
    // We build the network request NOW, before the bot placeholder exists in the DB!
    const assembly = await this.contextBuilder.buildStreamRequest(session);
    const request = assembly.request;

    // DO NOT REMOVE the bot message MUST be later than the user message
    const botTime = now.add({ milliseconds: 1 });
    // --- STEP 3: BOT PLACEHOLDER (UI STATE) ---
    const botMsgId = URN.create('message', crypto.randomUUID(), 'llm');
    const botMsg: LlmMessage = {
      id: botMsgId,
      typeId: TextType,
      sessionId: sessionId,
      role: 'model',
      timestamp: botTime.toString() as ISODateTimeString,
      payloadBytes: new Uint8Array(),
      isExcluded: false,
    };

    this.activeBotId = botMsgId;
    this.activeBotMsg = botMsg;

    await this.storage.saveMessage(botMsg);
    this.sink.addMessage(botMsg);

    // --- STEP 4: EXECUTE NETWORK STREAM ---
    this.accumulatedText = '';
    this.activeProposal.set(null); // Clear previous proposal

    // Ephemeral Architecture: We only pass the serialized request body to the stream
    this.activeSubscription = this.network.generateStream(request).subscribe({
      next: (event) => {
        if (event.type === 'text') {
          this.accumulatedText += event.content;
          if (this.activeBotId) {
            this.sink.updateMessagePayload(
              this.activeBotId,
              encoder.encode(this.accumulatedText),
            );
          }
        } else if (event.type === 'proposal') {
          this.logger.debug('Received Tool Interception Proposal', event.event);
          this.activeProposal.set(event.event);

          const storagePayload = JSON.stringify({
            __type: 'workspace_proposal',
            data: event.event,
          });

          this.accumulatedText = storagePayload;

          if (this.activeBotId) {
            this.sink.updateMessagePayload(
              this.activeBotId,
              encoder.encode(this.accumulatedText),
            );
          }
        }
      },
      error: (err) => {
        this.logger.error('LLM Generation Failed', err);
        this.finalizeGeneration();
      },
      complete: () => {
        this.finalizeGeneration();
      },
    });
  }

  cancelGeneration(): void {
    if (this.activeSubscription) {
      this.activeSubscription.unsubscribe();
      this.sink.setLoading(false);
    }
  }

  resolveCancellation(action: 'save' | 'delete'): void {
    if (
      action === 'save' &&
      this.activeBotMsg &&
      this.accumulatedText.length > 0
    ) {
      const finalMsg: LlmMessage = {
        ...this.activeBotMsg,
        payloadBytes: encoder.encode(this.accumulatedText),
      };
      this.storage.saveMessage(finalMsg);
    } else if (action === 'delete' && this.activeBotId) {
      this.sink.removeMessage(this.activeBotId);
      this.storage.deleteMessages([this.activeBotId]);
    }

    this.activeSubscription = null;
    this.activeBotId = null;
    this.activeBotMsg = null;
    this.accumulatedText = '';
    this.activeProposal.set(null);
  }

  private finalizeGeneration(): void {
    this.sink.setLoading(false);

    if (this.activeBotMsg && this.accumulatedText.length > 0) {
      const finalMsg: LlmMessage = {
        ...this.activeBotMsg,
        payloadBytes: encoder.encode(this.accumulatedText),
      };
      this.storage.saveMessage(finalMsg);
    }

    this.activeSubscription = null;
    this.activeBotId = null;
    this.activeBotMsg = null;
    this.accumulatedText = '';
  }

  async groupMessages(
    messageIds: string[],
    sessionId: URN,
    payload: { urn?: string; newName?: string },
  ): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    let targetUrnStr = payload.urn;

    if (payload.newName) {
      const newUrn = URN.create('tag', crypto.randomUUID(), 'llm');
      targetUrnStr = newUrn.toString();

      const session = await this.storage.getSession(sessionId);
      if (session) {
        session.contextGroups = {
          ...(session.contextGroups || {}),
          [targetUrnStr]: payload.newName,
        };
        await this.storage.saveSession(session);
        this.sessionSource.refresh();
      }
    }

    if (!targetUrnStr) return;
    const groupUrn = URN.parse(targetUrnStr);

    for (const idStr of messageIds) {
      try {
        const urn = URN.parse(idStr);
        const msg = await this.storage.getMessage(urn);

        if (msg) {
          const existingTags = msg.tags || [];
          if (!existingTags.some((t) => t.equals(groupUrn))) {
            const updatedTags = [...existingTags, groupUrn];
            const updatedMsg: LlmMessage = { ...msg, tags: updatedTags };

            await this.storage.saveMessage(updatedMsg);
            this.sink.updateMessageTags(urn, updatedTags);
          }
        }
      } catch (e) {
        this.logger.error(`Failed to group message ${idStr}`, e);
      }
    }
  }

  async extractToNewSession(
    messageIds: string[],
    activeSessionId: URN,
    mode: 'copy' | 'move',
  ): Promise<URN> {
    if (!messageIds || messageIds.length === 0)
      throw new Error('No messages selected');

    const newSessionId = URN.create('session', crypto.randomUUID(), 'llm');
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    const newSession: LlmSession = {
      id: newSessionId,
      title: mode === 'copy' ? 'Branched Session' : 'Extracted Session',
      lastModified: now,
      contextGroups: {},
      attachments: [],
    };

    await this.storage.saveSession(newSession);

    for (const idStr of messageIds) {
      try {
        const urn = URN.parse(idStr);
        const msg = await this.storage.getMessage(urn);

        if (msg) {
          if (mode === 'move') {
            const movedMsg: LlmMessage = { ...msg, sessionId: newSessionId };
            await this.storage.saveMessage(movedMsg);
            this.sink.removeMessage(urn);
          } else {
            const newMsgId = URN.create('message', crypto.randomUUID(), 'llm');
            const copiedMsg: LlmMessage = {
              ...msg,
              id: newMsgId,
              sessionId: newSessionId,
            };
            await this.storage.saveMessage(copiedMsg);
          }
        }
      } catch (e) {
        this.logger.error(`Failed to ${mode} message ${idStr}`, e);
      }
    }

    this.sessionSource.refresh();
    return newSessionId;
  }

  async deleteSelected(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    const urns = messageIds.map((id) => URN.parse(id));
    await this.storage.deleteMessages(urns);
    this.sink.removeMessages(urns);
  }

  async toggleExcludeSelected(
    messageIds: string[],
    exclude: boolean,
  ): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    const urns = messageIds.map((id) => URN.parse(id));
    await this.storage.updateMessageExclusions(urns, exclude);
    this.sink.updateMessageExclusions(urns, exclude);
  }
}
