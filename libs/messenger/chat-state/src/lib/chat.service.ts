/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Injectable, signal, inject, OnDestroy, WritableSignal } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  EncryptedDigest,
  SecureEnvelope,
} from '@nx-platform-application/messenger-types';
import {
  Subject,
  Subscription,
  timer,
  switchMap,
  EMPTY,
  catchError,
  filter,
  takeUntil,
  firstValueFrom,
  from, // <-- IMPORT 'from'
} from 'rxjs';

// --- Platform Service Imports ---
import { AuthService } from '@nx-platform-application/platform-auth-data-access';
import { KeyService } from '@nx-platform-application/key-data-access';
import { CryptoService } from '@nx-platform-application/crypto-data-access';

// --- New Data Service Imports ---
import { ChatDataService } from '@nx-platform-application/chat-data-access';
import {
  ChatLiveDataService,
  ConnectionStatus,
} from '@nx-platform-application/chat-live-data';

// --- View Models ---
import { DecryptedMessage } from './models/decrypted-message.model';

export interface ConversationSummary {
  conversationUrn: URN;
  latestSnippet: string; // Decrypted plaintext
  timestamp: Date;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  // --- Dependencies ---
  private readonly authService = inject(AuthService);
  private readonly keyService = inject(KeyService);
  private readonly cryptoService = inject(CryptoService);
  private readonly chatDataService = inject(ChatDataService);
  private readonly chatLiveService = inject(ChatLiveDataService);

  // --- State Signals ---
  public readonly activeConversations = signal<ConversationSummary[]>([]);
  public readonly messages = signal<DecryptedMessage[]>([]);

  // --- Internal State ---
  private readonly selectedConversation = signal<URN | null>(null);
  private pollingSub?: Subscription;
  private destroy$ = new Subject<void>();

  constructor() {
    this.initLiveSubscriptions();
    this.chatLiveService.connect();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.pollingSub?.unsubscribe();
  }

  // --- Core Workflows ---

  async loadInitialDigest(): Promise<void> {
    try {
      const encryptedDigest = await firstValueFrom(
        this.chatDataService.fetchMessageDigest()
      );

      // We cannot decrypt snippets from the digest as per 'digest.ts'
      const summaries = encryptedDigest.items.map((item) => {
        return {
          conversationUrn: item.conversationUrn,
          latestSnippet: '[Encrypted Message]', // Placeholder
          timestamp: new Date(), // Placeholder
        };
      });

      this.activeConversations.set(summaries);
    } catch (error) {
      console.error('Failed to load initial digest:', error);
    }
  }

  async selectConversation(urn: URN): Promise<void> {
    this.selectedConversation.set(urn);
    this.messages.set([]);

    try {
      const envelopes = await firstValueFrom(
        this.chatDataService.fetchConversationHistory(urn)
      );

      const decryptedMessages = await this.decryptEnvelopes(envelopes);
      this.messages.set(decryptedMessages);
    } catch (error) {
      console.error(`Failed to load history for ${urn}:`, error);
    }
  }

  async sendMessage(recipientURN: URN, plaintext: string): Promise<void> {
    try {
      const senderUrn = this.authService.currentUser()!.id;
      const recipientKeys = await this.keyService.getKey(recipientURN);
      const myKeys = await this.getMyKeys();

      const plaintextBytes = new TextEncoder().encode(plaintext);
      const { encryptedSymmetricKey, encryptedData } =
        await this.cryptoService.encryptForRecipient(
          recipientKeys.encKey,
          plaintextBytes
        );
      const signature = await this.cryptoService.signData(
        myKeys.sigKey,
        encryptedData
      );

      const envelope: SecureEnvelope = {
        senderId: URN.parse(senderUrn),
        recipientId: recipientURN,
        messageId: self.crypto.randomUUID(),
        encryptedSymmetricKey: encryptedSymmetricKey,
        encryptedData: encryptedData,
        signature: signature,
      };

      await firstValueFrom(this.chatDataService.postMessage(envelope));

      this.upsertMessage({
        from: senderUrn,
        to: recipientURN.toString(),
        content: plaintext,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  // --- Live/Fallback Implementation ---

  private initLiveSubscriptions(): void {
    // --- THIS IS THE REFACTOR ---
    // We use RxJS operators to handle the async decryption
    // This removes the 'async' from the 'subscribe' block.
    this.chatLiveService.incomingMessage$
      .pipe(
        switchMap((envelope) => {
          // 'from' converts the Promise from decryptEnvelopes
          // into an Observable, which switchMap can handle.
          return from(this.decryptEnvelopes([envelope]));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((messages) => {
        // This code is now fully synchronous!
        if (messages.length > 0) {
          this.upsertMessage(messages[0]);
        }
      });
    // ----------------------------

    this.chatLiveService.status$
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.handleConnectionStatus(status);
      });
  }

  private handleConnectionStatus(status: ConnectionStatus): void {
    if (status === 'connected') {
      this.pollingSub?.unsubscribe();
      this.pollingSub = undefined; // Clear subscription
      this.loadInitialDigest();
    }

    if (status === 'disconnected' && !this.pollingSub) {
      this.pollingSub = timer(0, 15000)
        .pipe(switchMap(() => this.loadInitialDigest()))
        .subscribe();
    }
  }

  // --- Helper Methods ---

  private async decryptEnvelopes(
    envelopes: SecureEnvelope[]
  ): Promise<DecryptedMessage[]> {
    const myKeys = await this.getMyKeys();
    const newMessages: DecryptedMessage[] = [];

    for (const env of envelopes) {
      try {
        const senderKeys = await this.keyService.getKey(env.senderId);

        const isValid = await this.cryptoService.verifySender(
          senderKeys.sigKey,
          env.signature,
          env.encryptedData
        );

        if (!isValid) {
          console.warn(`Invalid signature from ${env.senderId}. Discarding.`);
          continue;
        }

        const decryptedBytes = await this.cryptoService.decryptData(
          myKeys.encKey,
          env.encryptedSymmetricKey,
          env.encryptedData
        );

        const plaintext = new TextDecoder().decode(decryptedBytes);
        newMessages.push({
          from: env.senderId.toString(),
          to: env.recipientId.toString(),
          content: plaintext,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error(`Failed to decrypt message from ${env.senderId}:`, error);
      }
    }
    return newMessages;
  }

  private upsertMessage(message: DecryptedMessage): void {
    const selectedUrn = this.selectedConversation();
    const conversationUrn = this.getConversationUrn(message);

    if (selectedUrn && selectedUrn.toString() === conversationUrn.toString()) {
      this.messages.update((current) => [...current, message]);
    }

    this.activeConversations.update((current) => {
      const summary: ConversationSummary = {
        conversationUrn: conversationUrn,
        latestSnippet: message.content,
        timestamp: message.timestamp,
      };
      return [
        summary,
        ...current.filter((c) => c.conversationUrn.toString() !== conversationUrn.toString()),
      ];
    });
  }

  private getMyKeys() {
    const currentUser = this.authService.currentUser();
    if (!currentUser) throw new Error('Authentication error: No user found.');
    return this.cryptoService.loadMyKeys(currentUser.id);
  }

  private getConversationUrn(message: DecryptedMessage): URN {
    const myId = this.authService.currentUser()!.id;
    const urnString = message.from === myId ? message.to : message.from;
    return URN.parse(urnString);
  }
}
