// --- File: libs/messenger/data-access/sealed-sender.service.ts ---

import { Injectable, inject } from '@angular/core';

// --- Platform Imports (Generic Tools) ---
import {
  Crypto,
  PrivateKeys,
} from '@nx-platform-application/sdk-core';
import {
  StorageProvider,
  IndexedDb,
} from '@nx-platform-application/platform-storage';
import {
  URN,
  PublicKeys,
  SecureEnvelope,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

import { SecureKeyService }  from '@nx-platform-application/key-v2-access'

// --- WebCrypto Import Parameters ---
const rsaOaepImportParams: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
};
const rsaPssImportParams: RsaHashedImportParams = {
  name: 'RSA-PSS',
  hash: 'SHA-256',
};

// --- Base64 Helpers ---
const b64Encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode.apply(null, Array.from(bytes)));
const b64Decode = (str: string) =>
  new Uint8Array(atob(str).split('').map((c) => c.charCodeAt(0)));

// --- Inner Payload Interfaces ---
export interface EncryptedMessagePayload {
  senderId: URN;
  sentTimestamp: ISODateTimeString;
  typeId: URN;
  payloadBytes: Uint8Array;
}

export interface EncryptedMessagePayload_JsonSafe {
  senderId: string;
  sentTimestamp: ISODateTimeString;
  typeId: string;
  payloadBytes_b64: string;
}

@Injectable({
  providedIn: 'root',
})
export class SealedSenderService {
  // --- Dependencies ---
  private readonly crypto = inject(Crypto);
  private readonly keyService = inject(SecureKeyService);
  private readonly storage: StorageProvider = inject(IndexedDb);

  // --- (Key management methods: generateAndStoreKeys, loadMyKeys) ---
  // ... (These are unchanged from the previous version) ...

  /**
   * Generates new encryption and signing key pairs for the messenger app,
   * stores them securely in IndexedDb.
   */
  async generateAndStoreKeys(userId: string): Promise<PublicKeys> {
    const encKeyPair = await this.crypto.generateEncryptionKeys();
    const sigKeyPair = await this.crypto.generateSigningKeys();

    await this.storage.saveKeyPair(this.getEncKeyUrn(userId), encKeyPair);
    await this.storage.saveKeyPair(this.getSigKeyUrn(userId), sigKeyPair);

    const encKeyRaw = await crypto.subtle.exportKey('spki', encKeyPair.publicKey);
    const sigKeyRaw = await crypto.subtle.exportKey('spki', sigKeyPair.publicKey);

    return {
      encKey: new Uint8Array(encKeyRaw),
      sigKey: new Uint8Array(sigKeyRaw),
    };
  }

  /**
   * Loads the current user's private keys from secure storage.
   * This is required for decrypting messages and signing new ones.
   */
  async loadMyKeys(userId: string): Promise<PrivateKeys> {
    const encKeyPair = await this.storage.loadKeyPair(this.getEncKeyUrn(userId));
    const sigKeyPair = await this.storage.loadKeyPair(this.getSigKeyUrn(userId));

    if (!encKeyPair || !sigKeyPair) {
      throw new Error(
        `Failed to load keys for user ${userId}. One or more keys not found.`
      );
    }
    return {
      encKey: encKeyPair.privateKey,
      sigKey: sigKeyPair.privateKey,
    };
  }

  // --- URN Helper Functions ---
  private getEncKeyUrn = (userId: string): string =>
    `messenger:${userId}:key:encryption`;
  private getSigKeyUrn = (userId: string): string =>
    `messenger:${userId}:key:signing`;


  /**
   * NEW METHOD 1: encryptAndSign
   */
  async encryptAndSign(
    payload: EncryptedMessagePayload,
    recipientPublicKeys: PublicKeys,
    myPrivateKeys: PrivateKeys
  ): Promise<Omit<SecureEnvelope, 'recipientId'>> {
    // 1. Convert payload to JSON-safe version
    const jsonSafePayload: EncryptedMessagePayload_JsonSafe = {
      senderId: payload.senderId.toString(),
      sentTimestamp: payload.sentTimestamp,
      typeId: payload.typeId.toString(),
      payloadBytes_b64: b64Encode(payload.payloadBytes),
    };

    // 2. JSON.stringify and TextEncoder
    const payloadString = JSON.stringify(jsonSafePayload);
    const payloadBytes = new TextEncoder().encode(payloadString);

    // 3. Import recipient's public *encryption* key
    const recipientEncKey = await crypto.subtle.importKey(
      'spki',
      recipientPublicKeys.encKey as BufferSource,
      rsaOaepImportParams,
      true,
      ['encrypt']
    );

    // 4. Encrypt the payload
    const { encryptedData, encryptedSymmetricKey } = await this.crypto.encrypt(
      recipientEncKey,
      payloadBytes
    );

    // 5. Sign the *ciphertext* with my *signing* key
    const signature = await this.crypto.sign(
      myPrivateKeys.sigKey,
      encryptedData
    );

    // 6. Return all pieces for the outer envelope
    return {
      encryptedData,
      encryptedSymmetricKey,
      signature,
    };
  }

  /**
   * NEW METHOD 2: verifyAndDecrypt
   */
  async verifyAndDecrypt(
    envelope: SecureEnvelope,
    myPrivateKeys: PrivateKeys
  ): Promise<EncryptedMessagePayload> {
    // 1. Decrypt the inner payload
    const innerPayloadBytes = await this.crypto.decrypt(
      myPrivateKeys.encKey,
      envelope.encryptedSymmetricKey,
      envelope.encryptedData
    );

    // 2. Parse payload to find *claimed* sender
    const payloadString = new TextDecoder().decode(innerPayloadBytes);
    const jsonSafePayload: EncryptedMessagePayload_JsonSafe =
      JSON.parse(payloadString);
    const claimedSenderId = URN.parse(jsonSafePayload.senderId);

    // 3. Get the sender's public *signing* key
    const senderPublicKeys = await this.keyService.getKey(claimedSenderId);

    // 4. Import the sender's *signing* key
    const senderSigKey = await crypto.subtle.importKey(
      'spki',
      senderPublicKeys.sigKey as BufferSource,
      rsaPssImportParams,
      true,
      ['verify']
    );

    // 5. Verify the signature against the *ciphertext*
    const isValid = await this.crypto.verify(
      senderSigKey,
      envelope.signature,
      envelope.encryptedData
    );

    // 6. If not valid, THROW
    if (!isValid) {
      throw new Error('Message Forged: Signature verification failed.');
    }

    // 7. It's authentic. Return the smart payload.
    return {
      senderId: claimedSenderId,
      sentTimestamp: jsonSafePayload.sentTimestamp as ISODateTimeString,
      typeId: URN.parse(jsonSafePayload.typeId),
      payloadBytes: b64Decode(jsonSafePayload.payloadBytes_b64),
    };
  }
}
