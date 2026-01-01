// libs/messenger/cloud-sync/src/lib/models/sync-options.interface.ts

export interface SyncOptions {
  /** Which provider to use (e.g., 'google') */
  providerId: string;

  /** Should we sync contacts? */
  syncContacts: boolean;

  /** Should we sync chat history? */
  syncMessages: boolean;
}

export interface SyncResult {
  success: boolean;
  contactsProcessed: boolean;
  messagesProcessed: boolean;
  errors: string[];
  timestamp: string;
}
