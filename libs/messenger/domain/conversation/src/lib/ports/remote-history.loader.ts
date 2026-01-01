import { URN } from '@nx-platform-application/platform-types';

/**
 * PORT: Interface for fetching historical data from a remote source (Cloud).
 * This decouples the Conversation Domain from the specific Sync implementation.
 */
export abstract class RemoteHistoryLoader {
  abstract isCloudEnabled(): boolean;
  abstract restoreVaultForDate(date: string, urn: URN): Promise<number>;
}
