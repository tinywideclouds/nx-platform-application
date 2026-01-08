export interface DevicePairingSession {
    sessionId: string;
    publicKey?: CryptoKey;
    oneTimeKey?: CryptoKey;
    privateKey?: CryptoKey;
    qrPayload: string;
    mode: 'RECEIVER_HOSTED' | 'SENDER_HOSTED';
}
