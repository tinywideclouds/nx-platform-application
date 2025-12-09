import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatDataService } from '@nx-platform-application/chat-access';
import { EncryptedMessagePayload } from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';

// CONSTANT for the Trojan Horse message type
const DEVICE_SYNC_TYPE = 'urn:message:type:device-sync';

@Injectable({ providedIn: 'root' })
export class HotQueueMonitor {
  private logger = inject(Logger);
  private dataService = inject(ChatDataService);
  private crypto = inject(MessengerCryptoService);

  /**
   * POLLS the Hot Queue for a specific "Trojan Horse" message.
   *
   * @param sessionKey - The ephemeral key (AES or RSA) used to unlock the message.
   * @param myUrn - The user's URN (used to verify ownership).
   * @returns The decrypted payload if found, or null if the queue is empty/irrelevant.
   *
   * SECURITY NOTE: This service NEVER acknowledges messages.
   * It peeks, attempts to decrypt, and leaves the message in the queue.
   * The message is only acknowledged later by the main ChatIngestionService
   * once the device is fully authenticated and running the normal pipeline.
   */
  async checkQueueForInvite(
    sessionKey: CryptoKey,
    myUrn: URN
  ): Promise<EncryptedMessagePayload | null> {
    // 1. Fetch a small batch from the Hot Queue
    const batch = await firstValueFrom(this.dataService.getMessageBatch(50));

    if (batch.length === 0) return null;

    this.logger.debug(`[HotQueueSpy] Peeking at ${batch.length} messages...`);

    for (const msg of batch) {
      try {
        // 2. Attempt Decrypt
        // We use a specialized method that tries the sessionKey.
        // If the message was NOT encrypted with this key, it will throw.
        let decrypted: EncryptedMessagePayload;

        if (sessionKey.algorithm.name === 'RSA-OAEP') {
          // Receiver-Hosted Flow (RSA)
          decrypted = await this.crypto.decryptSyncMessage(
            msg.envelope,
            sessionKey
          );
        } else {
          // Sender-Hosted Flow (AES)
          decrypted = await this.crypto.decryptSyncOffer(
            msg.envelope,
            sessionKey
          );
        }

        // 3. Validate Type
        if (decrypted.typeId.toString() === DEVICE_SYNC_TYPE) {
          this.logger.info('[HotQueueSpy] 🎯 Trojan Horse Found!');
          return decrypted;
        }
      } catch (e) {
        // Expected behavior: Most messages in the queue are NOT for us (they are old chat messages).
        // We silently ignore decryption failures here.
        continue;
      }
    }

    return null;
  }
}
