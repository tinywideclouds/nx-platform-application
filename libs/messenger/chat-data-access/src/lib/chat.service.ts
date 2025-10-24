import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

// --- Imports from NX mono-repo libraries ---
import { AuthService } from '@nx-platform-application/platform-auth-data-access';
import { ContactsService } from '@nx-platform-application/contacts-data-access';
import { KeyService } from '@nx-platform-application/key-data-access';
import { CryptoService } from '@nx-platform-application/crypto-data-access';
import { URN } from '@nx-platform-application/platform-types'; // 1. IMPORT URN

// --- Local Imports ---
import { DecryptedMessage } from './models/decrypted-message.model';
import { b64ToBytes, bytesToB64 } from './utils/base64.utils';

/**
 * Interface for the JSON payload sent to/from the API.
 * Uses Base64 strings for transport.
 */
interface TransportEnvelope {
  from: string; // URN string
  to: string; // URN string
  timestamp: string;
  encryptedSymmetricKey: string; // Base64
  encryptedData: string; // Base64
  signature: string; // Base64
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  // --- Dependencies (Refactored) ---
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly contactsService = inject(ContactsService);
  private readonly keyService = inject(KeyService);
  private readonly cryptoService = inject(CryptoService); // The "smart facade"

  // --- Public State ---
  public readonly messages = signal<DecryptedMessage[]>([]);

  /**
   * Sends a new encrypted and signed message to a recipient.
   */
  async sendMessage(recipientUrn: string, plaintext: string): Promise<void> {
    try {
      // 1. Get current user
      const currentUser = this.authService.currentUser();
      if (!currentUser) throw new Error('Authentication error: No user found.');
      const senderUrn = currentUser.id; // This is a string

      // 2. Get recipient's public keys (as Uint8Arrays)
      // (FIX: Parse string to URN for keyService)
      const recipientKeys = await this.keyService.getKey(
        URN.parse(recipientUrn)
      );

      // 3. Load our own private keys (as CryptoKeys)
      // (Correct: cryptoService expects a string)
      const myKeys = await this.cryptoService.loadMyKeys(senderUrn);

      // 4. Encrypt and Sign (USING THE FACADE)
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

      // 5. Construct the transport envelope (Base64 encoding)
      const envelope: TransportEnvelope = {
        from: senderUrn,
        to: recipientUrn,
        timestamp: new Date().toISOString(),
        encryptedSymmetricKey: bytesToB64(encryptedSymmetricKey),
        encryptedData: bytesToB64(encryptedData),
        signature: bytesToB64(signature),
      };

      // 6. POST to the backend
      await lastValueFrom(this.http.post('/api/messages', envelope));
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  /**
   * Polls the backend for new messages, verifies, decrypts,
   * and updates the public messages signal.
   */
  async pollMessages(): Promise<void> {
    try {
      // 1. Get all envelopes from the backend
      const envelopes = await lastValueFrom(
        this.http.get<TransportEnvelope[]>('/api/messages')
      );

      // 2. Load our own private keys (as CryptoKeys)
      const currentUser = this.authService.currentUser();
      if (!currentUser) throw new Error('Auth error: No user to poll for.');
      // (Correct: cryptoService expects a string)
      const myKeys = await this.cryptoService.loadMyKeys(currentUser.id);

      // 3. Loop, verify, and decrypt
      const decryptionPromises = envelopes.map(async (envelope) => {
        try {
          // 4. Get sender's public keys (as Uint8Arrays)
          const senderUrn = envelope.from; // This is a string
          // (FIX: Parse string to URN for keyService)
          const senderKeys = await this.keyService.getKey(URN.parse(senderUrn));

          // 5. Convert Base64 payload back to bytes
          const signatureBytes = b64ToBytes(envelope.signature);
          const dataBytes = b64ToBytes(envelope.encryptedData);
          const keyBytes = b64ToBytes(envelope.encryptedSymmetricKey);

          // 6. Verify signature (USING THE FACADE)
          const isValid = await this.cryptoService.verifySender(
            senderKeys.sigKey,
            signatureBytes,
            dataBytes // This is what was signed
          );

          if (!isValid) {
            console.warn(
              `Invalid signature from ${senderUrn}. Message discarded.`
            );
            return null;
          }

          // 7. Decrypt payload (USING THE FACADE)
          const decryptedBytes = await this.cryptoService.decryptData(
            myKeys.encKey, // Our private encryption key
            keyBytes,
            dataBytes
          );

          const plaintext = new TextDecoder().decode(decryptedBytes);

          // 8. Map to view model
          return {
            from: envelope.from,
            to: envelope.to,
            content: plaintext,
            timestamp: new Date(envelope.timestamp),
          } as DecryptedMessage;
        } catch (error) {
          console.error(`Failed to decrypt message ${envelope.from}:`, error);
          return null; // Don't let one bad message stop the whole poll
        }
      });

      const newMessages = (await Promise.all(decryptionPromises)).filter(
        (msg): msg is DecryptedMessage => msg !== null
      );

      // 9. Update the public signal
      this.messages.set(newMessages);
    } catch (error) {
      console.error('Failed to poll messages:', error);
    }
  }
}

