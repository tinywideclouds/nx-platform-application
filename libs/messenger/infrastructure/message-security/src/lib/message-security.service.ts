import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  SecureEnvelope,
  PublicKeys,
  URN,
} from '@nx-platform-application/platform-types';
import {
  serializePayloadToProtoBytes,
  deserializeProtoBytesToPayload,
  TransportMessage,
} from '@nx-platform-application/messenger-types';

// We import the CryptoEngine helper (assuming it's still accessible or moved here)
import {
  CryptoEngine,
  rsaOaepImportParams,
  rsaPssImportParams,
} from '@nx-platform-application/messenger-infrastructure-private-keys';
import { WebCryptoKeys } from '@nx-platform-application/messenger-infrastructure-private-keys'; // The type we just agreed on
import { SecureKeyService } from '@nx-platform-application/messenger-infrastructure-key-access';

@Injectable({ providedIn: 'root' })
export class MessageSecurityService {
  private readonly logger = inject(Logger);

  private keyService = inject(SecureKeyService);
  private readonly cryptoEngine = inject(CryptoEngine);

  public async encryptAndSign(
    payload: TransportMessage,
    recipientId: URN,
    myPrivateKeys: WebCryptoKeys,
    recipientPublicKeys: PublicKeys,
  ): Promise<SecureEnvelope> {
    const payloadBytes = serializePayloadToProtoBytes(payload);

    const recipientEncKey = await crypto.subtle.importKey(
      'spki',
      recipientPublicKeys.encKey as BufferSource,
      rsaOaepImportParams,
      true,
      ['encrypt'],
    );

    const { encryptedSymmetricKey, encryptedData } =
      await this.cryptoEngine.encrypt(recipientEncKey, payloadBytes);

    const signature = await this.cryptoEngine.sign(
      myPrivateKeys.sigKey,
      encryptedData,
    );

    return {
      recipientId: recipientId,
      encryptedSymmetricKey: encryptedSymmetricKey,
      encryptedData: encryptedData,
      signature: signature,
    };
  }

  public async encryptSyncMessage(
    payload: TransportMessage,
    sessionPublicKey: CryptoKey,
    myPrivateKeys: WebCryptoKeys,
  ): Promise<SecureEnvelope> {
    const payloadBytes = serializePayloadToProtoBytes(payload);

    const { encryptedSymmetricKey, encryptedData } =
      await this.cryptoEngine.encrypt(sessionPublicKey, payloadBytes);

    const signature = await this.cryptoEngine.sign(
      myPrivateKeys.sigKey,
      encryptedData,
    );

    return {
      recipientId: payload.senderId,
      encryptedSymmetricKey,
      encryptedData,
      signature,
    };
  }

  public async encryptSyncOffer(
    payload: TransportMessage,
    oneTimeKey: CryptoKey,
  ): Promise<SecureEnvelope> {
    const payloadBytes = serializePayloadToProtoBytes(payload);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      oneTimeKey,
      new Uint8Array(payloadBytes),
    );

    const encryptedData = new Uint8Array(
      iv.length + encryptedContent.byteLength,
    );
    encryptedData.set(iv, 0);
    encryptedData.set(new Uint8Array(encryptedContent), iv.length);

    return {
      recipientId: payload.senderId,
      encryptedSymmetricKey: new Uint8Array(0),
      encryptedData,
      signature: new Uint8Array(0),
    };
  }

  public async verifyAndDecrypt(
    envelope: SecureEnvelope,
    myPrivateKeys: WebCryptoKeys,
  ): Promise<TransportMessage> {
    return this.internalVerifyAndDecrypt(envelope, myPrivateKeys.encKey);
  }

  public async decryptSyncMessage(
    envelope: SecureEnvelope,
    sessionPrivateKey: CryptoKey,
  ): Promise<TransportMessage> {
    return this.internalVerifyAndDecrypt(envelope, sessionPrivateKey);
  }

  public async decryptSyncOffer(
    envelope: SecureEnvelope,
    oneTimeKey: CryptoKey,
  ): Promise<TransportMessage> {
    const iv = envelope.encryptedData.slice(0, 12);
    const ciphertext = envelope.encryptedData.slice(12);

    const decryptedBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      oneTimeKey,
      ciphertext,
    );

    return deserializeProtoBytesToPayload(new Uint8Array(decryptedBytes));
  }

  // --- Private Helpers ---

  private async internalVerifyAndDecrypt(
    envelope: SecureEnvelope,
    decryptionKey: CryptoKey,
  ): Promise<TransportMessage> {
    const innerPayloadBytes = await this.cryptoEngine.decrypt(
      decryptionKey,
      envelope.encryptedSymmetricKey,
      envelope.encryptedData,
    );

    const innerPayload = deserializeProtoBytesToPayload(innerPayloadBytes);
    const claimedSenderId = innerPayload.senderId;

    const senderPublicKeys = await this.keyService.getKey(claimedSenderId);

    if (!senderPublicKeys) {
      throw new Error(
        `Verification Failed: Could not find public keys for sender ${claimedSenderId}`,
      );
    }

    const senderSigKey = await crypto.subtle.importKey(
      'spki',
      senderPublicKeys.sigKey as BufferSource,
      rsaPssImportParams,
      true,
      ['verify'],
    );

    const isValid = await this.cryptoEngine.verify(
      senderSigKey,
      envelope.signature,
      envelope.encryptedData,
    );

    if (!isValid) {
      throw new Error('Message Forged: Signature verification failed.');
    }

    return innerPayload;
  }
}
