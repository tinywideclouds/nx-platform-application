import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  QueuedMessage,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  OutboundTask,
  RecipientProgress,
  TransportMessage,
} from '@nx-platform-application/messenger-types';
import {
  ChatStorageService,
  OutboxStorage,
  QuarantineStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';

// ✅ NEW IMPORTS for Full Wipe
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

// Mocks
import {
  MockLiveService,
  MockChatDataService,
} from './services/mock-network.service';
import { MockKeyService } from './services/mock-key.service';
import {
  MESSENGER_SCENARIOS,
  SCENARIO_USERS,
  MockMessageDef,
  MockOutboxDef,
  MockQuarantineDef,
} from './scenarios.const';

@Injectable({ providedIn: 'root' })
export class MessengerScenarioDriver {
  private router = inject(MockChatDataService);
  private live = inject(MockLiveService);
  private keys = inject(MockKeyService);

  // --- STORAGE SERVICES (For Wiping/Seeding) ---
  private chatStorage = inject(ChatStorageService);
  private outboxStorage = inject(OutboxStorage);
  private quarantineStorage = inject(QuarantineStorage);

  // ✅ NEW: Added for wiping contacts and keys
  private contactsStorage = inject(ContactsStorageService);
  private cryptoService = inject(MessengerCryptoService);

  // Low-level crypto for seeding
  private crypto = inject(CryptoEngine);

  constructor() {
    // ✅ EXPOSE TO WINDOW
    // This allows you to run `await window.messengerDriver.loadScenario('active-chat')` in the console
    (window as any).messengerDriver = this;
    console.log(
      '[MessengerScenarioDriver] initialized and attached to window.messengerDriver',
    );
  }

  /**
   * INSTANT LOAD: Wipes ALL DBs (Chat, Contacts, Keys) and seeds a scenario.
   */
  async loadScenario(key: string): Promise<void> {
    const data = MESSENGER_SCENARIOS[key as keyof typeof MESSENGER_SCENARIOS];
    if (!data) {
      console.warn(`[ScenarioDriver] Unknown scenario: "${key}"`);
      return;
    }

    console.log(`[ScenarioDriver] 🔄 Loading "${key}"...`);

    // 1. WIPE EVERYTHING (The Fix for "Ghost Data")
    // We run these in parallel to ensure a complete clean slate
    await Promise.all([
      this.chatStorage.clearDatabase(), // Wipes Messages, Convos, Settings
      this.contactsStorage.clearDatabase(), // ✅ Wipes Contacts & Groups
      this.cryptoService.clearKeys(), // ✅ Wipes Identity Keys
      this.outboxStorage.clearAll(), // ✅ Wipes Pending Tasks
      //this.quarantineStorage.deleteQuarantinedMessages(),    // (Usually covered by chatStorage, but good to be safe if method exists)
    ]);

    console.log('[ScenarioDriver] 🧹 Database Wiped.');

    // 2. Seed Messages
    if (data.messages) {
      for (const msgDef of data.messages) {
        await this.seedMessage(msgDef);
      }
    }

    // 3. Seed Outbox
    if (data.outbox) {
      for (const taskDef of data.outbox) {
        await this.seedOutbox(taskDef);
      }
    }

    // 4. Seed Quarantine
    if (data.quarantine) {
      for (const qDef of data.quarantine) {
        await this.seedQuarantine(qDef);
      }
    }

    // 5. Force Reload (Optional)
    // If the app state is already running, we might need to nudge it to reload data.
    // For now, we rely on the user reloading or the app reacting to DB changes if wired up.
    // But typically, `loadScenario` is followed by a page reload OR the app listens to changes.
    // Given we just wiped keys, the Identity Facade might need a reset signal if it's already running.

    console.log(`[ScenarioDriver] ✅ Scenario Loaded.`);
  }

  // --- SEEDERS ---

  private async seedMessage(def: MockMessageDef): Promise<void> {
    const dummyKey = (await this.crypto.generateEncryptionKeys()).publicKey;
    const encrypted = await this.crypto.encrypt(
      dummyKey,
      new TextEncoder().encode(def.text),
    );

    const message: ChatMessage = {
      id: def.id,
      conversationUrn: URN.parse('urn:messenger:convo:seed'), // Simplified
      senderId: def.senderUrn,
      sentTimestamp: def.sentAt as ISODateTimeString,
      typeId: URN.parse('urn:message:type:text'),
      payloadBytes: encrypted.encryptedData,
      status: def.status,
      receiptMap: {},
      tags: [],
      textContent: def.text,
    };

    await this.chatStorage.saveMessage(message);
  }

  private async seedOutbox(def: MockOutboxDef): Promise<void> {
    const recipients: RecipientProgress[] = def.recipientUrns.map((urn) => ({
      urn,
      status: 'pending',
      attempts: 0,
    }));

    const dummyKey = (await this.crypto.generateEncryptionKeys()).publicKey;
    const encrypted = await this.crypto.encrypt(
      dummyKey,
      new TextEncoder().encode(def.text),
    );

    const task: OutboundTask = {
      id: def.id,
      messageId: def.messageId,
      conversationUrn: URN.parse('urn:messenger:convo:seed'),
      typeId: URN.parse('urn:message:type:text'),
      payload: encrypted.encryptedData,
      tags: [],
      recipients,
      status: def.status,
      createdAt: Temporal.Now.instant().toString() as ISODateTimeString,
    };

    await this.outboxStorage.addTask(task);
  }

  private async seedQuarantine(def: MockQuarantineDef): Promise<void> {
    const dummyKey = (await this.crypto.generateEncryptionKeys()).publicKey;
    const encrypted = await this.crypto.encrypt(
      dummyKey,
      new TextEncoder().encode(def.text),
    );

    const transportMsg: TransportMessage = {
      senderId: def.senderUrn,
      sentTimestamp: def.sentAt as ISODateTimeString,
      typeId: MessageTypeText,
      payloadBytes: encrypted.encryptedData,
    };

    await this.quarantineStorage.saveQuarantinedMessage(transportMsg);
  }

  // --- NETWORK SIMULATION ---

  async simulateIncomingMessage(
    sender: URN,
    text: string,
    recipient: URN = SCENARIO_USERS.ME,
  ): Promise<void> {
    console.log(`[Scenario] 📨 Incoming: "${text}" from ${sender}`);

    const senderKeys = await this.crypto.generateSigningKeys();
    let myEncryptionKeys;
    try {
      myEncryptionKeys = await this.crypto.generateEncryptionKeys();
    } catch (e) {
      myEncryptionKeys = await this.crypto.generateEncryptionKeys();
    }

    const payloadBytes = new TextEncoder().encode(text);
    const encryptedPayload = await this.crypto.encrypt(
      myEncryptionKeys.publicKey,
      payloadBytes,
    );

    const envelope = {
      recipientId: recipient,
      encryptedSymmetricKey: new Uint8Array(0),
      encryptedData: encryptedPayload.encryptedData,
      signature: new Uint8Array(0),
      isEphemeral: false,
    };

    const queuedMsg: QueuedMessage = {
      id: `msg-${Date.now()}`,
      envelope: envelope as any,
    };

    this.router.enqueue(queuedMsg);
    this.live.triggerPoke();
  }

  async simulateNewUser(): Promise<void> {
    console.log('[Scenario] 👶 Simulating New User');
    await this.loadScenario('empty'); // Re-use the full wipe logic
  }
}
