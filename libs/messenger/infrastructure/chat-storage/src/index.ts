import { OutboxStorage } from '@nx-platform-application/messenger-domain-outbox';
import { QuarantineStorage } from '@nx-platform-application/messenger-domain-quarantine';

import { DexieOutboxStorage } from './lib/services/dexie-outbox.storage';
import { DexieQuarantineStorage } from './lib/services/dexie-quarantine.storage';

export const CHAT_STORAGE_PROVIDERS = [
  { provide: OutboxStorage, useClass: DexieOutboxStorage },
  { provide: QuarantineStorage, useClass: DexieQuarantineStorage },
];

export * from './lib/services/chat-storage.service';
export * from './lib/services/dexie-outbox.storage';
export * from './lib/services/dexie-quarantine.storage';
