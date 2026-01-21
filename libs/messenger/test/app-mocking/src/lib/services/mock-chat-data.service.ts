import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { QueuedMessage, URN } from '@nx-platform-application/platform-types';
import { IChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { MockServerNetworkState, MockMessageDef } from '../scenarios.const';

@Injectable({ providedIn: 'root' })
export class MockChatDataService implements IChatDataService {
  private serverQueue: QueuedMessage[] = [];

  // --- CONFIGURATION API (Scenario Driver) ---

  /**
   * ✅ SCENARIO AWARE:
   * Accepts the high-level scenario definition and converts it into
   * the complex "Wire Format" (QueuedMessage) expected by the app.
   */
  loadScenario(config: MockServerNetworkState) {
    console.log(
      `[MockChatDataService] 🔄 Loading Queue: ${config.queuedMessages.length} items`,
    );
    this.serverQueue = config.queuedMessages.map((def) =>
      this.convertToQueuedMessage(def),
    );
  }

  /**
   * Helper to simulate the Server wrapping a message in an encrypted envelope.
   */
  private convertToQueuedMessage(def: MockMessageDef): QueuedMessage {
    return {
      id: def.id,
      envelope: {
        recipientId: URN.parse('urn:contacts:user:me'),
        // In Mock mode, we just encode the text so it's readable in DevTools/Tests
        // The MockCryptoEngine will "decrypt" this back to text.
        encryptedData: new TextEncoder().encode(def.text),

        // Dummy values to satisfy the type
        encryptedSymmetricKey: new Uint8Array(0),
        signature: new Uint8Array(0),
        isEphemeral: false,
      } as any,
    };
  }

  // --- IChatDataService Implementation ---

  getMessageBatch(limit: number = 50): Observable<QueuedMessage[]> {
    const batch = this.serverQueue.slice(0, limit);
    return of(batch);
  }

  acknowledge(messageIds: string[]): Observable<void> {
    console.log('[MockChatDataService] 🗑 Acking messages:', messageIds);
    this.serverQueue = this.serverQueue.filter(
      (m) => !messageIds.includes(m.id),
    );
    return of(void 0);
  }
}
