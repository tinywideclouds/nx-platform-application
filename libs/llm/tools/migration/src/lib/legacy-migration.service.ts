import { Injectable, inject, signal } from '@angular/core';
import {
  LlmStorageService,
  ProposalRegistryStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
import {
  FileProposalType,
  FileLinkType,
  PointerPayload,
  RegistryEntry,
} from '@nx-platform-application/llm-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';

@Injectable({ providedIn: 'root' })
export class LegacyMigrationService {
  private storage = inject(LlmStorageService);
  private registry = inject(ProposalRegistryStorageService);
  private logger = inject(Logger);
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  // Reactive state so the UI knows if the alert bell should be visible
  readonly pendingLegacyCount = signal<number>(0);

  /**
   * Scans all sessions to count how many legacy proposals exist.
   */
  async scanForLegacyProposals(): Promise<number> {
    try {
      let count = 0;
      const sessions = await this.storage.getSessions();

      for (const session of sessions) {
        const messages = await this.storage.getSessionMessages(session.id);
        const legacyMessages = messages.filter((m) =>
          m.typeId.equals(FileProposalType),
        );
        count += legacyMessages.length;
      }

      this.pendingLegacyCount.set(count);
      return count;
    } catch (e) {
      this.logger.error('Failed to scan for legacy proposals', e);
      return 0;
    }
  }

  /**
   * Executes the migration: Extracts the embedded JSON, creates a Registry Entry,
   * converts the message to a FileLinkType pointer, and overwrites the DB record.
   */
  async executeMigration(): Promise<void> {
    const sessions = await this.storage.getSessions();
    let migratedCount = 0;

    for (const session of sessions) {
      const messages = await this.storage.getSessionMessages(session.id);
      console.log('session messages', messages.length);
      let sessionUpdated = false;

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        if (msg.typeId.equals(FileProposalType) && msg.payloadBytes) {
          try {
            // 1. Parse legacy payload
            const rawJson = this.decoder.decode(msg.payloadBytes);
            const parsed = JSON.parse(rawJson);
            const event =
              parsed.__type === 'workspace_proposal' ? parsed.data : parsed;
            const proposal = event.proposal;

            const proposalUrn = URN.parse(`urn:files:proposal:${proposal.id}`);

            // 2. Write heavy data to new Registry
            const registryEntry: RegistryEntry = {
              id: proposalUrn,
              ownerSessionId: session.id,
              filePath: proposal.filePath,
              status: proposal.status,
              patch: proposal.patch,
              newContent: proposal.newContent,
              reasoning: proposal.reasoning,
              createdAt: proposal.createdAt,
            };
            console.log('saving proposal', registryEntry);
            await this.registry.saveProposal(registryEntry);

            // 3. Create lightweight pointer
            const pointer: PointerPayload = {
              proposalId: proposalUrn,
              filePath: proposal.filePath,
              snippet: proposal.newContent
                ? proposal.newContent.split('\n').slice(0, 12).join('\n')
                : '// Legacy migrated code block',
              reasoning: proposal.reasoning || '',
            };

            // 4. Mutate the message to the new type
            messages[i] = {
              ...msg,
              typeId: FileLinkType,
              payloadBytes: this.encoder.encode(JSON.stringify(pointer)),
            };

            sessionUpdated = true;
            migratedCount++;
          } catch (e) {
            this.logger.error(`Failed to migrate message ${msg.id}`, e);
          }
        }
      }

      // If we altered messages in this session, save the whole array back to IDB
      if (sessionUpdated) {
        // Assuming your storage service has an upsert/save method for messages:
        console.log('bulk save');
        await this.storage.bulkSaveMessages(messages);
      }
    }

    // Reset the alert bell
    this.pendingLegacyCount.set(0);
    this.logger.info(
      `Successfully migrated ${migratedCount} legacy proposals.`,
    );
  }
}
