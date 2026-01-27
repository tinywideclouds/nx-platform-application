import { Injectable, inject } from '@angular/core';
import { DirectoryStorageService } from '@nx-platform-application/directory-infrastructure-storage';
import { directoryScenarios } from './data/directory-scenarios.const';

@Injectable({ providedIn: 'root' })
export class DirectoryScenarioService {
  private storage = inject(DirectoryStorageService);

  async initialize(scenarioKey = 'populated'): Promise<void> {
    const data =
      directoryScenarios[scenarioKey as keyof typeof directoryScenarios];

    if (!data) {
      console.warn(`[DirectoryScenario] Unknown scenario "${scenarioKey}".`);
      return;
    }

    console.info(`[DirectoryScenario] Seeding Network Truth: "${scenarioKey}"`);

    // 1. Wipe DB
    await this.storage.clearDatabase();

    // 2. Seed Users
    if (data.entities.length) {
      await this.storage.bulkUpsert(data.entities);
    }

    // 3. Seed Groups
    if (data.groups.length) {
      for (const group of data.groups) {
        await this.storage.saveGroup(group);
      }
    }

    console.info(`[DirectoryScenario] Network State Loaded.`);
  }
}
