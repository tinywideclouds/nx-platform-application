import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { TransportMessage } from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

const DEVICE_SYNC_TYPE = 'urn:message:type:device-sync';

@Injectable({ providedIn: 'root' })
export class HotQueueMonitor {
  private logger = inject(Logger);
  private dataService = inject(ChatDataService);
  private crypto = inject(MessengerCryptoService);

  async checkQueueForInvite(
    sessionKey: CryptoKey,
    myUrn: URN,
  ): Promise<TransportMessage | null> {
    // 1. Fetch
    const batch = await firstValueFrom(this.dataService.getMessageBatch(50));

    if (batch.length === 0) return null;

    this.logger.debug(`[HotQueueSpy] Peeking at ${batch.length} messages...`);

    for (const msg of batch) {
      try {
        this.logger.debug(`[HotQueueSpy] Inspecting Msg ${msg.id}...`);

        let decrypted: TransportMessage;

        // 2. Decrypt
        if (sessionKey.algorithm.name === 'RSA-OAEP') {
          // Receiver-Hosted Flow (RSA)
          decrypted = await this.crypto.decryptSyncMessage(
            msg.envelope,
            sessionKey,
          );
        } else {
          // Sender-Hosted Flow (AES)
          decrypted = await this.crypto.decryptSyncOffer(
            msg.envelope,
            sessionKey,
          );
        }

        const typeStr = decrypted.typeId.toString();
        this.logger.debug(`[HotQueueSpy] Decrypted Type: ${typeStr}`);

        // 3. Validate
        if (typeStr === DEVICE_SYNC_TYPE) {
          this.logger.info('[HotQueueSpy] 🎯 Trojan Horse Found!');
          return decrypted;
        } else {
          this.logger.debug(`[HotQueueSpy] Ignoring message type: ${typeStr}`);
        }
      } catch (e) {
        // ✅ CRITICAL LOG: Why did decryption fail?
        // This usually means "Wrong Key" or "Message wasn't meant for this session"
        this.logger.warn(`[HotQueueSpy] Decryption failed for ${msg.id}`, e);
        continue;
      }
    }

    return null;
  }
}
