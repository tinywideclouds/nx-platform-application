import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  MessageStorageService,
  SessionStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
import {
  FileLinkType,
  LlmMessage,
  LlmSession,
  PointerPayload,
  SSEProposalEvent,
  TextType,
} from '@nx-platform-application/llm-types';
import { LlmScrollSource } from '@nx-platform-application/llm-features-chat';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import {
  LlmContextBuilderService,
  ContextAssembly,
} from '@nx-platform-application/llm-domain-context';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';

const encoder = new TextEncoder();

export interface SendMessageOptions {
  modelToUse?: string;
  onPreflight?: (
    assembly: ContextAssembly,
  ) => Promise<{ send: boolean; disableFuture: boolean }>;
}

@Injectable({ providedIn: 'root' })
export class LlmChatActions {
  private readonly logger = inject(Logger);
  private sink = inject(LlmScrollSource);
  private sessionSource = inject(LlmSessionSource);
  private messageStorage = inject(MessageStorageService);
  private sessionStorage = inject(SessionStorageService);
  private network = inject(LLM_NETWORK_CLIENT);
  private contextBuilder = inject(LlmContextBuilderService);
  private proposalService = inject(LlmProposalService);

  readonly registryMutated = signal<number>(0);

  // Cancellation & State Tracking
  private activeSubscription: Subscription | null = null;
  private activeBotId: URN | null = null;
  private accumulatedText = '';
  private activeBotMsg: LlmMessage | null = null;

  // State for the UI to bind the Diff Viewer to
  readonly activeProposal = signal<SSEProposalEvent | null>(null);

  // Ephemeral Thought State
  readonly activeThought = signal<string>('');

  public defaultModel = 'gemini-2.5-pro';

  private extractCleanSnippet(patch?: string, newContent?: string): string {
    if (patch) {
      const lines = patch
        .split('\n')
        .filter(
          (l) =>
            !l.startsWith('---') && !l.startsWith('+++') && !l.startsWith('@@'),
        );
      return lines.slice(0, 12).join('\n') + (lines.length > 5 ? '\n...' : '');
    }
    if (newContent) {
      return newContent.split('\n').slice(0, 5).join('\n') + '\n...';
    }
    return 'No preview available';
  }

  async sendMessage(
    text: string,
    sessionId: URN,
    options?: SendMessageOptions,
  ): Promise<void> {
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

    await this.messageStorage.saveMessage(userMsg);
    this.sink.addMessage(userMsg);

    // --- STEP 2: ASSEMBLE CONTEXT ---
    const assembly = await this.contextBuilder.buildStreamRequest(
      session,
      options?.modelToUse,
    );

    // --- STEP 3: DELEGATED PRE-FLIGHT CHECK ---
    if (session.enablePreFlightPreview && options?.onPreflight) {
      const result = await options.onPreflight(assembly);

      if (!result.send) {
        this.sink.setLoading(false);
        return; // Halt generation. User message stays in history as an orphaned input.
      }

      if (result.disableFuture) {
        const updatedSession: LlmSession = {
          ...session,
          strategy: {
            ...session.strategy!,
          },
          enablePreFlightPreview: false,
        };
        await this.sessionStorage.saveSession(updatedSession);
        this.sessionSource.refresh();
      }
    }

    // --- STEP 4: BOT PLACEHOLDER ---
    const botTime = now.add({ milliseconds: 1 });
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

    await this.messageStorage.saveMessage(botMsg);
    this.sink.addMessage(botMsg);

    // --- STEP 5: EXECUTE NETWORK STREAM ---
    this.accumulatedText = '';
    this.activeProposal.set(null);
    this.activeThought.set('');

    this.activeSubscription = this.network
      .generateStream(assembly.request)
      .subscribe({
        next: (event) => {
          if (event.type === 'thought') {
            this.activeThought.update((prev) => prev + event.content);
          } else if (event.type === 'text') {
            if (!this.activeBotId) {
              this.activeBotId = URN.create(
                'message',
                crypto.randomUUID(),
                'llm',
              );
              this.accumulatedText = '';

              const newTextMsg: LlmMessage = {
                id: this.activeBotId,
                typeId: TextType,
                sessionId: sessionId,
                role: 'model',
                timestamp:
                  Temporal.Now.instant().toString() as ISODateTimeString,
                payloadBytes: new Uint8Array(),
                isExcluded: false,
              };

              this.activeBotMsg = newTextMsg;
              this.messageStorage.saveMessage(newTextMsg);
              this.sink.addMessage(newTextMsg);
            }

            this.accumulatedText += event.content;
            this.sink.updateMessagePayload(
              this.activeBotId,
              encoder.encode(this.accumulatedText),
            );
          } else if (event.type === 'proposal') {
            this.logger.debug(
              'Received Tool Interception Proposal',
              event.event,
            );
            this.activeProposal.set(event.event);

            if (this.activeBotId && this.activeBotMsg) {
              const finalMsg: LlmMessage = {
                ...this.activeBotMsg,
                payloadBytes: encoder.encode(this.accumulatedText),
              };
              this.messageStorage.saveMessage(finalMsg);
            }

            const sseEvent = event.event as SSEProposalEvent;
            const p = sseEvent.proposal;

            const proposalUrn = p.id.startsWith('urn:')
              ? URN.parse(p.id)
              : URN.create('proposal', p.id, 'llm');

            this.proposalService.saveChangeProposal(session.id, proposalUrn, p);

            const pointer: PointerPayload = {
              proposalId: proposalUrn,
              filePath: p.filePath,
              snippet: p.newContent
                ? p.newContent.split('\n').slice(0, 12).join('\n')
                : this.extractCleanSnippet(p.patch),
              reasoning: p.reasoning,
            };

            const pointerMsgId = URN.create(
              'message',
              crypto.randomUUID(),
              'llm',
            );

            const pointerMsg: LlmMessage = {
              id: pointerMsgId,
              typeId: FileLinkType,
              sessionId: sessionId,
              role: 'model',
              timestamp: Temporal.Now.instant().toString() as ISODateTimeString,
              payloadBytes: encoder.encode(JSON.stringify(pointer)),
              isExcluded: false,
            };

            this.messageStorage.saveMessage(pointerMsg);
            this.sink.addMessage(pointerMsg);

            this.activeBotId = null;
            this.activeBotMsg = null;
            this.accumulatedText = '';
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
      this.messageStorage.saveMessage(finalMsg);
    } else if (action === 'delete' && this.activeBotId) {
      this.sink.removeMessage(this.activeBotId);
      this.messageStorage.deleteMessages([this.activeBotId]);
    }

    this.activeSubscription = null;
    this.activeBotId = null;
    this.activeBotMsg = null;
    this.accumulatedText = '';
    this.activeProposal.set(null);
    this.activeThought.set('');
  }

  private finalizeGeneration(): void {
    this.sink.setLoading(false);

    if (
      this.activeBotId &&
      this.activeBotMsg &&
      this.accumulatedText.length > 0
    ) {
      const finalMsg: LlmMessage = {
        ...this.activeBotMsg,
        payloadBytes: encoder.encode(this.accumulatedText),
      };
      this.messageStorage.saveMessage(finalMsg);
    }

    this.activeSubscription = null;
    this.activeBotId = null;
    this.activeBotMsg = null;
    this.accumulatedText = '';
    this.activeThought.set('');
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
      this.logger.warn(
        'Tag name saving is temporarily bypassed due to session schema update.',
      );
    }

    if (!targetUrnStr) return;
    const groupUrn = URN.parse(targetUrnStr);

    for (const idStr of messageIds) {
      try {
        const urn = URN.parse(idStr);
        const msg = await this.messageStorage.getMessage(urn);

        if (msg) {
          const existingTags = msg.tags || [];
          if (!existingTags.some((t) => t.equals(groupUrn))) {
            const updatedTags = [...existingTags, groupUrn];
            const updatedMsg: LlmMessage = { ...msg, tags: updatedTags };

            await this.messageStorage.saveMessage(updatedMsg);
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
    mode: 'copy' | 'move',
  ): Promise<URN> {
    if (!messageIds || messageIds.length === 0)
      throw new Error('No messages selected');

    const newSessionId = URN.create('session', crypto.randomUUID(), 'llm');
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    const newSession: LlmSession = {
      id: newSessionId,
      llmModel: this.defaultModel,
      title: mode === 'copy' ? 'Branched Session' : 'Extracted Session',
      lastModified: now,
      inlineContexts: [],
      systemContexts: [],
      compiledContext: undefined,
      quickContext: [],
    };

    await this.sessionStorage.saveSession(newSession);

    for (const idStr of messageIds) {
      try {
        const urn = URN.parse(idStr);
        const msg = await this.messageStorage.getMessage(urn);

        if (msg) {
          if (mode === 'move') {
            const movedMsg: LlmMessage = { ...msg, sessionId: newSessionId };
            await this.messageStorage.saveMessage(movedMsg);
            this.sink.removeMessage(urn);
          } else {
            const newMsgId = URN.create('message', crypto.randomUUID(), 'llm');
            const copiedMsg: LlmMessage = {
              ...msg,
              id: newMsgId,
              sessionId: newSessionId,
            };
            await this.messageStorage.saveMessage(copiedMsg);
          }
        }
      } catch (e) {
        this.logger.error(`Failed to ${mode} message ${idStr}`, e);
      }
    }

    this.sessionSource.refresh();
    return newSessionId;
  }

  async updateMessageText(
    messageIdStr: string,
    newText: string,
  ): Promise<void> {
    try {
      const msgId = URN.parse(messageIdStr);
      const msg = await this.messageStorage.getMessage(msgId);

      if (msg) {
        const encoder = new TextEncoder();
        const payloadBytes = encoder.encode(newText);
        const updatedMsg: LlmMessage = { ...msg, payloadBytes };

        await this.messageStorage.saveMessage(updatedMsg);
        this.sink.updateMessagePayload(msgId, payloadBytes);
      }
    } catch (e) {
      this.logger.error(`Failed to update message text for ${messageIdStr}`, e);
    }
  }

  async deleteSelected(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    const urns = messageIds.map((id) => URN.parse(id));
    await this.messageStorage.deleteMessages(urns);
    this.sink.removeMessages(urns);
  }

  async toggleExcludeSelected(
    messageIds: string[],
    exclude: boolean,
  ): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    const urns = messageIds.map((id) => URN.parse(id));
    await this.messageStorage.updateMessageExclusions(urns, exclude);
    this.sink.updateMessageExclusions(urns, exclude);
  }
}
