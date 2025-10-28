/**
 * A view model representing a message after it has been
 * successfully decrypted and verified.
 */
export interface DecryptedMessage {
  from: string; // User ID of the sender
  to: string; // User ID of the recipient
  content: string; // The plaintext message content
  timestamp: Date;
}
