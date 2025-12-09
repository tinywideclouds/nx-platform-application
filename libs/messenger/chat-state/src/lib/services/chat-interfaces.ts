export interface LinkSession {
  sessionId: string;
  publicKey?: CryptoKey; // For Receiver-Hosted (Target holds Priv)
  oneTimeKey?: CryptoKey; // For Sender-Hosted (Source holds Key)
  privateKey?: CryptoKey;
  qrPayload: string;
  mode: 'RECEIVER_HOSTED' | 'SENDER_HOSTED';
}
