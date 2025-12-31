import {
  ChatMessage,
  MessageTombstone,
} from '@nx-platform-application/messenger-types';

export interface ChatVault {
  /** Schema version (e.g., 1) */
  version: number;
  /** Unique ID for this vault, typically "YYYY_MM" (e.g., "2024_01") */
  vaultId: string;
  /** ISO timestamp of the earliest message in this vault */
  rangeStart: string;
  /** ISO timestamp of the latest message in this vault */
  rangeEnd: string;
  /** Total messages */
  messageCount: number;
  /** The actual message data */
  messages: ChatMessage[];

  /** Deletions to synchronize */
  tombstones: MessageTombstone[];
}

export interface VaultManifest {
  version: number;
  vaultId: string; // "2024_01"

  /** A unified set of ALL Conversation URNs present in the vault. */
  participants: string[];

  /** Metadata to help UI show loading state */
  messageCount: number;
  rangeStart: string;
  rangeEnd: string;
}
