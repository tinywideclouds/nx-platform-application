import { Injectable, inject } from '@angular/core';
import {
  ContactsStorageService,
  GatekeeperStorage,
} from '@nx-platform-application/contacts-storage';
import { SCENARIOS } from '@nx-platform-application/contacts-app-mocking';

/**
 * Service responsible for wiping and seeding the database
 * based on the current URL query parameters.
 * * Usage: ?scenario=populated (Default) or ?scenario=empty
 */
@Injectable({ providedIn: 'root' })
export class ScenarioService {
  private contactsStorage = inject(ContactsStorageService);
  private gatekeeperStorage = inject(GatekeeperStorage);

  async initialize(defaultScenario = 'populated'): Promise<void> {
    // 1. Determine Scenario
    const params = new URLSearchParams(window.location.search);
    const scenarioKey = params.get('scenario') || defaultScenario;
    const data = SCENARIOS[scenarioKey as keyof typeof SCENARIOS];

    if (!data) {
      console.warn(
        `[ScenarioService] Unknown scenario "${scenarioKey}". Skipping seed.`,
      );
      return;
    }

    console.info(`[ScenarioService] Initializing Scenario: "${scenarioKey}"`);

    // 2. Wipe Database (Ensure clean slate)
    await this.contactsStorage.clearDatabase();

    // 3. Seed Data
    // We use the real storage services to ensure indexes and logic (if any) are respected.

    // Contacts
    if (data.contacts.length) {
      await this.contactsStorage.bulkUpsert(data.contacts);
    }

    // Groups
    for (const group of data.groups) {
      await this.contactsStorage.saveGroup(group);
    }

    // Gatekeeper (Pending)
    for (const p of data.pending) {
      await this.gatekeeperStorage.addToPending(
        p.urn,
        p.vouchedBy ? p.vouchedBy : undefined,
        p.note,
      );
    }

    // Gatekeeper (Blocked)
    for (const b of data.blocked) {
      await this.gatekeeperStorage.blockIdentity(b.urn, b.scopes, b.reason);
    }

    console.info(
      `[ScenarioService] Scenario "${scenarioKey}" loaded successfully.`,
    );
  }
}
