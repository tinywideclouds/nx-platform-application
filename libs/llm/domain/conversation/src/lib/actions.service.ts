import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmMessage, LlmSession } from '@nx-platform-application/llm-types';
import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { LlmContextBuilderService } from './context-builder.service';

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

  /**
   * The Full "Chat Loop":
   * 1. Optimistic User Message (Sink + DB)
   * 2. Bot Placeholder (Sink)
   * 3. Network Stream -> Update Placeholder (Sink)
   * 4. Stream Complete -> Save Bot Message (DB)
   */
  async sendMessage(text: string, sessionId: URN): Promise<void> {
    const now = Temporal.Now.instant();
    const encoder = new TextEncoder();

    // --- STEP 1: USER MESSAGE ---
    const userMsg: LlmMessage = {
      id: URN.create('message', crypto.randomUUID(), 'llm'),
      sessionId,
      role: 'user',
      typeId: URN.parse('urn:llm:message-type:text'),
      payloadBytes: encoder.encode(text),
      timestamp: now.toString() as ISODateTimeString,
    };

    this.logger.debug('message -> sink', userMsg);
    this.sink.addMessage(userMsg);

    // Await save to ensure the DB is perfectly up-to-date before context building
    await this.storage.saveMessage(userMsg);
    this.logger.debug('message -> saved', userMsg);

    // NEW: Refresh the sidebar so a brand new session appears immediately,
    // or an existing session is bumped to the top of the list.
    this.sessionSource.refresh();

    this.sink.setLoading(true);

    // --- STEP 2: BOT PLACEHOLDER ---
    this.activeBotId = URN.create('message', crypto.randomUUID(), 'llm');
    const botNow = now.add({ milliseconds: 100 }); // Ensure bot message is always after user message
    this.activeBotMsg = {
      id: this.activeBotId,
      sessionId,
      role: 'model',
      typeId: URN.parse('urn:llm:message-type:text'),
      payloadBytes: new Uint8Array(), // Empty
      timestamp: botNow.toString() as ISODateTimeString,
    };

    this.logger.debug('llm message -> sink', this.activeBotMsg);
    this.sink.addMessage(this.activeBotMsg);

    // --- STEP 3: ASSEMBLE CONTEXT & CHECK MEMORY ---
    // Unwrapping the newly typed ContextAssembly
    const assembly = await this.contextBuilder.buildStreamRequest(sessionId);
    const request = assembly.request;

    this.logger.debug('llm assembled session', assembly.request.session_id);

    // Future-Proofing: Alert the system if long-term memory needs a flush
    if (assembly.memoryMetrics.isFlushRecommended) {
      console.log(
        `[Memory Alert] Session ${sessionId} has ${assembly.memoryMetrics.archivableCount} archivable messages. Ready for long-term flush.`,
      );
    }

    // --- STEP 4: EXECUTE NETWORK STREAM ---
    this.accumulatedText = '';

    // Assign to activeSubscription so we can cancel it via the UI

    this.logger.debug(
      'llm assembled session -> microservice',
      request.session_id,
    );
    console.log('LLM Stream Request', request);
    this.activeSubscription = this.network.generateStream(request).subscribe({
      next: (chunk) => {
        this.accumulatedText += chunk;
        console.log('Received chunk', {
          chunk,
          accumulated: this.accumulatedText,
        });
        if (this.activeBotId) {
          this.sink.updateMessagePayload(
            this.activeBotId,
            encoder.encode(this.accumulatedText),
          );
        }
      },
      error: (err) => {
        console.error('LLM Generation Failed', err);
        this.finalizeGeneration();
      },
      complete: () => {
        this.finalizeGeneration();
      },
    });
  }

  /**
   * Called by the UI (chat-window.component.ts) to stop generation.
   * This unsubscribes from the observable, triggering the AbortController
   * in the network client, which drops the connection to the Go server.
   */
  cancelGeneration(): void {
    if (this.activeSubscription) {
      this.activeSubscription.unsubscribe();
      this.sink.setLoading(false);
    }
  }

  /**
   * Called by the UI after the Snackbar resolves.
   */
  resolveCancellation(action: 'save' | 'delete'): void {
    if (
      action === 'save' &&
      this.activeBotMsg &&
      this.accumulatedText.length > 0
    ) {
      // User wants to keep it: Commit to DB
      const encoder = new TextEncoder();
      const finalMsg: LlmMessage = {
        ...this.activeBotMsg,
        payloadBytes: encoder.encode(this.accumulatedText),
      };
      this.storage.saveMessage(finalMsg);
    } else if (action === 'delete' && this.activeBotId) {
      // User wants it gone: Scrub from the UI (it was never in the DB)
      this.sink.removeMessage(this.activeBotId);
    }

    // Reset state securely
    this.activeSubscription = null;
    this.activeBotId = null;
    this.activeBotMsg = null;
    this.accumulatedText = '';
  }

  /**
   * Ensures the loading state is cleared, the final/partial message
   * is saved to the database, and state is reset.
   */
  private finalizeGeneration(): void {
    this.sink.setLoading(false);

    if (this.activeBotMsg && this.accumulatedText.length > 0) {
      const encoder = new TextEncoder();
      const finalMsg: LlmMessage = {
        ...this.activeBotMsg,
        payloadBytes: encoder.encode(this.accumulatedText),
      };
      this.storage.saveMessage(finalMsg);
    }

    // Cleanup to prevent memory leaks or rogue state
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

    // 1. Handle New Group Creation
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

    // 2. Tag the Messages
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

  /**
   * Branches a conversation by moving selected messages to a brand new session.
   * Returns the new Session URN so the caller can navigate.
   */
  async extractToNewSession(
    messageIds: string[],
    activeSessionId: URN,
    mode: 'copy' | 'move',
  ): Promise<URN> {
    if (!messageIds || messageIds.length === 0)
      throw new Error('No messages selected');

    // 1. Create the new Session
    const newSessionId = URN.create('session', crypto.randomUUID(), 'llm');
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    const newSession: LlmSession = {
      id: newSessionId,
      title: mode === 'copy' ? 'Branched Session' : 'Extracted Session',
      lastModified: now,
      contextGroups: {}, // Start with a clean dictionary
    };

    await this.storage.saveSession(newSession);

    // 2. Process the messages
    for (const idStr of messageIds) {
      try {
        const urn = URN.parse(idStr);
        const msg = await this.storage.getMessage(urn);

        if (msg) {
          if (mode === 'move') {
            // MOVE: Update existing record, remove from current UI
            const movedMsg: LlmMessage = { ...msg, sessionId: newSessionId };
            await this.storage.saveMessage(movedMsg);
            this.sink.removeMessage(urn);
          } else {
            // COPY: Generate new ID to avoid DB collision, keep in current UI
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

    // 3. Refresh sidebar and return the new ID
    this.sessionSource.refresh();
    return newSessionId;
  }
  /**
   * Permanently deletes selected messages from the database and UI.
   */
  async deleteSelected(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    const urns = messageIds.map((id) => URN.parse(id));

    // 1. Delete from DB
    await this.storage.deleteMessages(urns);

    // 2. Sync UI
    this.sink.removeMessages(urns);
  }

  /**
   * Toggles the 'Exclude' flag on selected messages.
   * Excluded messages remain visible but are ignored by the context builder.
   */
  async toggleExcludeSelected(
    messageIds: string[],
    exclude: boolean,
  ): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    const urns = messageIds.map((id) => URN.parse(id));

    // 1. Update DB
    await this.storage.updateMessageExclusions(urns, exclude);

    // 2. Sync UI
    this.sink.updateMessageExclusions(urns, exclude);
  }
}
