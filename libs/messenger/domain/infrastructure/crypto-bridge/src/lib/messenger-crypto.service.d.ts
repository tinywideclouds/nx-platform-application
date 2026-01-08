import { URN, PublicKeys, SecureEnvelope } from '@nx-platform-application/platform-types';
import { TransportMessage } from '@nx-platform-application/messenger-types';
import { PrivateKeys } from './types';
import * as i0 from "@angular/core";
export interface ReceiverSession {
    sessionId: string;
    qrPayload: string;
    privateKey: CryptoKey;
    publicKey: CryptoKey;
}
export interface SenderSession {
    sessionId: string;
    qrPayload: string;
    oneTimeKey: CryptoKey;
}
export interface ParsedQr {
    sessionId: string;
    key: CryptoKey;
    mode: 'RECEIVER_HOSTED' | 'SENDER_HOSTED';
}
export declare class MessengerCryptoService {
    private logger;
    private cryptoEngine;
    private storage;
    private keyService;
    generateReceiverSession(): Promise<ReceiverSession>;
    generateSenderSession(): Promise<SenderSession>;
    /**
     * Parses a raw QR string and imports the contained key.
     * Validates the mode 'm' BEFORE decoding the key to ensure safety.
     */
    parseQrCode(qrString: string): Promise<ParsedQr>;
    verifyKeysMatch(userUrn: URN, server: PublicKeys): Promise<boolean>;
    generateAndStoreKeys(userUrn: URN): Promise<{
        privateKeys: PrivateKeys;
        publicKeys: PublicKeys;
    }>;
    storeMyKeys(userUrn: URN, keys: PrivateKeys): Promise<void>;
    loadMyKeys(userUrn: URN): Promise<PrivateKeys | null>;
    loadMyPublicKeys(userUrn: URN): Promise<PublicKeys | null>;
    getFingerprint(keyBytes: Uint8Array): Promise<string>;
    encryptAndSign(payload: TransportMessage, recipientId: URN, myPrivateKeys: PrivateKeys, recipientPublicKeys: PublicKeys): Promise<SecureEnvelope>;
    encryptSyncMessage(payload: TransportMessage, sessionPublicKey: CryptoKey, myPrivateKeys: PrivateKeys): Promise<SecureEnvelope>;
    encryptSyncOffer(payload: TransportMessage, oneTimeKey: CryptoKey): Promise<SecureEnvelope>;
    verifyAndDecrypt(envelope: SecureEnvelope, myPrivateKeys: PrivateKeys): Promise<TransportMessage>;
    decryptSyncMessage(envelope: SecureEnvelope, sessionPrivateKey: CryptoKey): Promise<TransportMessage>;
    decryptSyncOffer(envelope: SecureEnvelope, oneTimeKey: CryptoKey): Promise<TransportMessage>;
    private internalVerifyAndDecrypt;
    private getEncKeyUrn;
    private getSigKeyUrn;
    private jwkToSpki;
    private compareBytes;
    private arrayBufferToBase64;
    private base64ToArrayBuffer;
    clearKeys(): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessengerCryptoService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MessengerCryptoService>;
}
