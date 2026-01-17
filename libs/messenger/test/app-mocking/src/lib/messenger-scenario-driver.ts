import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  QueuedMessage,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  MockLiveService,
  MockChatDataService,
} from './services/mock-network.service';
import { MockKeyService } from './services/mock-key.service';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

// Common User IDs for scenarios
export const SCENARIO_USERS = {
  ME: URN.parse('urn:contacts:user:me'),
  ALICE: URN.parse('urn:contacts:user:alice'),
  BOB: URN.parse('urn:contacts:user:bob'),
};

@Injectable()
export class MessengerScenarioDriver {
  private router = inject(MockChatDataService);
  private live = inject(MockLiveService);
  private keys = inject(MockKeyService); // Injects the Mock implementation
  private crypto = inject(MessengerCryptoService); // Real Crypto

  /**
   * SCENARIO: Receive a Text Message
   */
  async simulateIncomingMessage(
    sender: URN,
    text: string,
    recipient: URN = SCENARIO_USERS.ME,
  ): Promise<void> {
    console.log(`[Scenario] 📨 Incoming: "${text}" from ${sender}`);

    // 1. Ensure Sender (Alice) has keys (to sign)
    const senderKeys = await this.crypto.generateAndStoreKeys(sender);
    this.keys.registerUser(sender, senderKeys.publicKeys);

    // 2. Ensure Recipient (Me) has keys (to encrypt)
    // We check the mock server to see if 'Me' has registered keys yet.
    let myPubKeys;
    try {
      myPubKeys = await this.keys.getKey(recipient);
    } catch {
      console.warn(
        '[Scenario] Recipient has no keys on server. Generating temporary ones (Decryption will likely fail if app has different keys).',
      );
      const temp = await this.crypto.generateAndStoreKeys(recipient);
      myPubKeys = temp.publicKeys;
    }

    // 3. Encrypt the payload (Acting as Alice)
    const envelope = await this.crypto.encryptAndSign(
      {
        senderId: sender,
        sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
        typeId: URN.parse('urn:message:type:text'),
        payloadBytes: new TextEncoder().encode(text),
      },
      recipient, // Target
      senderKeys.privateKeys, // Signer (Alice)
      myPubKeys, // Encrypt for (Me)
    );

    // 4. Enqueue in Router
    const queuedMsg: QueuedMessage = {
      id: `msg-${Date.now()}`,
      envelope: envelope,
    };

    this.router.enqueue(queuedMsg);

    // 5. Poke the App
    this.live.triggerPoke();
  }

  /**
   * SCENARIO: New User (Wipe)
   */
  async simulateNewUser(): Promise<void> {
    console.log('[Scenario] 👶 Simulating New User');
    await this.crypto.clearKeys();
  }
}
