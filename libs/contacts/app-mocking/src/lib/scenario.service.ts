import { Injectable, inject } from '@angular/core';
import {
  ContactsStorageService,
  GatekeeperStorage,
} from '@nx-platform-application/contacts-infrastructure-storage';
import { DirectoryScenarioService } from '@nx-platform-application/directory-app-mocking';
import { scenarios } from './data/scenarios.const'; // ✅ Updated import (camelCase)

@Injectable({ providedIn: 'root' })
export class ContactsScenarioService {
  private contactsStorage = inject(ContactsStorageService);
  private gatekeeperStorage = inject(GatekeeperStorage);
  private dirScenario = inject(DirectoryScenarioService);

  async initialize(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const scenarioKey = params.get('scenario') || 'populated';

    // ✅ Updated to use the new camelCase constant
    const data = scenarios[scenarioKey as keyof typeof scenarios];

    if (!data) {
      console.warn(`[ContactsScenario] Unknown scenario "${scenarioKey}".`);
      return;
    }

    console.info(`[ContactsScenario] Initializing Scenario: "${scenarioKey}"`);

    // 1. Seed Network Truth (Directory)
    await this.dirScenario.initialize(scenarioKey);

    // 2. Wipe Local Database
    await this.contactsStorage.clearDatabase();

    // 3. Seed Contacts
    if (data.contacts.length) {
      await this.contactsStorage.bulkUpsert(data.contacts);
    }

    // 4. Seed Groups
    for (const group of data.groups) {
      await this.contactsStorage.saveGroup(group);
    }

    // 5. Seed Identity Links (Connecting Bob to Messenger)
    if (data.links) {
      for (const link of data.links) {
        await this.contactsStorage.linkIdentityToContact(
          link.contactId,
          link.authUrn,
          link.scope,
        );
      }
    }

    // 6. Seed Gatekeeper (Pending)
    for (const p of data.pending) {
      await this.gatekeeperStorage.addToPending(
        p.urn,
        p.vouchedBy ? p.vouchedBy : undefined,
        p.note,
      );
    }

    // 7. Seed Gatekeeper (Blocked)
    for (const b of data.blocked) {
      await this.gatekeeperStorage.blockIdentity(b.urn, b.scopes, b.reason);
    }

    console.info(`[ContactsScenario] Local State Loaded.`);
  }
}
