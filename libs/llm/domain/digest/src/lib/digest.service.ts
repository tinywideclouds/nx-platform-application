import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { LlmMemoryDigest } from '@nx-platform-application/llm-types';
import { DigestStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({ providedIn: 'root' })
export class LlmDigestService {
  private storage = inject(DigestStorageService);
  private logger = inject(Logger);

  /**
   * Fetches all digests for a specific session.
   */
  async getDigestsForSession(sessionId: URN): Promise<LlmMemoryDigest[]> {
    try {
      return await this.storage.getSessionDigests(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to fetch digests for session ${sessionId.toString()}`,
        error,
      );
      return [];
    }
  }

  /**
   * Saves a new or updated digest to storage.
   */
  async saveDigest(digest: LlmMemoryDigest): Promise<void> {
    try {
      await this.storage.saveDigest(digest);
      this.logger.debug(`Saved memory digest: ${digest.id.toString()}`);
    } catch (error) {
      this.logger.error(`Failed to save digest ${digest.id.toString()}`, error);
      throw error;
    }
  }

  /**
   * Deletes a specific digest by ID.
   */
  async deleteDigest(id: URN): Promise<void> {
    try {
      await this.storage.deleteDigest(id);
      this.logger.debug(`Deleted memory digest: ${id.toString()}`);
    } catch (error) {
      this.logger.error(`Failed to delete digest ${id.toString()}`, error);
      throw error;
    }
  }

  /**
   * Clears all digests associated with a session (e.g., when a session is deleted).
   */
  async clearSessionDigests(sessionId: URN): Promise<void> {
    try {
      await this.storage.clearSessionDigests(sessionId);
      this.logger.debug(
        `Cleared all digests for session: ${sessionId.toString()}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to clear digests for session ${sessionId.toString()}`,
        error,
      );
      throw error;
    }
  }
}
