// libs/messenger/chat-cloud-access/src/lib/models/chat-vault.interface.ts

import { DecryptedMessage } from '@nx-platform-application/messenger-types';
import { MessageTombstone } from '@nx-platform-application/chat-storage';

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
  messages: DecryptedMessage[];

  // ✅ Updated Type: Uses the clean domain contract
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
