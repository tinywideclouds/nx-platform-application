import { Injectable, inject } from '@angular/core';
import {
  URN,
  ISODateTimeString,
  serializePublicKeysToJson,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  TransportMessage,
} from '@nx-platform-application/messenger-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';

// Real Storage
import {
  ChatStorageService,
  OutboxStorage,
  QuarantineStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { KeyStorageService } from '@nx-platform-application/messenger-infrastructure-key-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import {
  MessengerCryptoService,
  CryptoEngine,
  PrivateKeys,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

// Scenario-Aware Mocks
import { MockAuthService } from './services/mock-auth.service';
import { MockKeyService } from './services/mock-key.service';
import { MockChatDataService } from './services/mock-chat-data.service';
import { MockLiveService } from './services/mock-live.service';
import { MockChatSendService } from './services/mock-chat-send.service';
import { MockPushNotificationService } from './services/mock-push-notification.service';

import {
  MESSENGER_SCENARIOS,
  MockMessageDef,
  MessengerScenarioData,
  SCENARIO_USERS,
} from './scenarios.const';

@Injectable({ providedIn: 'root' })
export class MessengerScenarioDriver {
  // --- MOCKS ---
  private authMock = inject(MockAuthService);
  private keyMock = inject(MockKeyService);
  private chatDataMock = inject(MockChatDataService);
  private liveMock = inject(MockLiveService);
  private sendMock = inject(MockChatSendService);
  private pushMock = inject(MockPushNotificationService);

  // --- REAL STORAGE ---
  private chatStorage = inject(ChatStorageService);
  private outboxStorage = inject(OutboxStorage);
  private contactsStorage = inject(ContactsStorageService);
  private publicKeysStorage = inject(KeyStorageService);
  private messengerCrypto = inject(MessengerCryptoService);
  private quarantineStorage = inject(QuarantineStorage);
  private keyCache = inject(KeyCacheService);

  private crypto = inject(CryptoEngine);

  private readonly STORAGE_KEY = 'messenger_active_scenario';

  constructor() {
    (window as any).messengerDriver = this;
  }

  public async initialize(): Promise<void> {
    // 1. Determine Target Scenario
    // Priority: URL > Default ('active-user')
    // We intentionally DO NOT read from localStorage here.
    const params = new URLSearchParams(window.location.search);
    const urlScenario = params.get('scenario');

    let activeKey = 'active-user';

    if (
      urlScenario &&
      MESSENGER_SCENARIOS[urlScenario as keyof typeof MESSENGER_SCENARIOS]
    ) {
      console.log(`[Driver] 🎯 URL Override detected: "${urlScenario}"`);
      activeKey = urlScenario;
    } else {
      console.log(`[Driver] 🎲 Defaulting to: "${activeKey}" (Fresh Start)`);
    }

    // 2. ENFORCE STATE (The Fix)
    // We actively overwrite whatever was in storage.
    // This wipes the "sticky" 'new-user' state from previous runs.
    localStorage.setItem(this.STORAGE_KEY, activeKey);

    // 3. Load
    await this.loadScenario(activeKey);
  }

  async loadScenario(key: string): Promise<void> {
    const scenario =
      MESSENGER_SCENARIOS[key as keyof typeof MESSENGER_SCENARIOS];
    if (!scenario) {
      console.error(`Unknown scenario: ${key}`);
      return;
    }

    console.log(`[Driver] 🎬 Activating Scenario: "${key}"`);
    localStorage.setItem(this.STORAGE_KEY, key);

    await this.wipeDevice();
    this.configureMocks(scenario.remote_server);
    await this.seedLocalDevice(scenario.local_device);

    console.log(`[Driver] ✅ Scenario Loaded.`);
  }

  // --- INTERNAL STEPS ---

  private configureMocks(config: MessengerScenarioData['remote_server']) {
    this.authMock.loadScenario(config.auth);
    this.keyMock.loadScenario(config.identity);
    this.chatDataMock.loadScenario(config.network);
    this.liveMock.loadScenario(config.network);
    this.sendMock.loadScenario(config.send);
  }

  private async wipeDevice() {
    console.log('[Driver] 🧹 Wiping Device Storage...');

    await this.chatStorage.clearDatabase();
    await this.contactsStorage.clearDatabase();
    await this.publicKeysStorage.clearDatabase();
    await this.messengerCrypto.clearKeys();

    await Promise.all([
      this.outboxStorage.clearAll(),
      this.quarantineStorage.clear(),
      this.keyCache.clear(),
    ]);
  }

  private async seedLocalDevice(config: MessengerScenarioData['local_device']) {
    // 1. Notifications
    this.pushMock.loadScenario(config.notifications);

    // 2. Identity
    if (config.identity?.seeded) {
      await this.seedLocalIdentity();
    }

    // 3. Contacts
    if (config.contacts && config.contacts.length > 0) {
      console.log(
        `[Driver] Seeding ${config.contacts.length} local contacts...`,
      );
      await this.contactsStorage.bulkUpsert(config.contacts);
    }

    // 4. Messages
    for (const msg of config.messages) {
      await this.seedMessageToStorage(msg);
    }

    // 5. Quarantine
    if (config.quarantine) {
      for (const msg of config.quarantine) {
        await this.seedQuarantineMessage(msg);
      }
    }
  }

  private async seedLocalIdentity() {
    console.log('[Driver] 🌱 Seeding Local Identity...');
    const myUrn = SCENARIO_USERS.ME;

    // Generate real keys using the engine (MockCryptoEngine in test mode)
    const encPair = await this.crypto.generateEncryptionKeys();
    const sigPair = await this.crypto.generateSigningKeys();

    const privateKeys: PrivateKeys = {
      encKey: encPair.privateKey,
      sigKey: sigPair.privateKey,
    };

    await this.messengerCrypto.storeMyKeys(myUrn, privateKeys);

    // Derive public keys using service logic
    const publicKeys = await this.messengerCrypto.loadMyPublicKeys(myUrn);
    if (!publicKeys) throw new Error('Failed to derive public keys');

    const serialized = serializePublicKeysToJson(publicKeys);
    const now = new Date().toISOString() as ISODateTimeString;
    await this.publicKeysStorage.storeKey(myUrn.toString(), serialized, now);

    console.log('[Driver] ✅ Identity Seeded.');
  }

  private async seedMessageToStorage(def: MockMessageDef) {
    const dummyKey = (await this.crypto.generateEncryptionKeys()).publicKey;
    const encrypted = await this.crypto.encrypt(
      dummyKey,
      new TextEncoder().encode(def.text),
    );
    const message: ChatMessage = {
      id: def.id,
      conversationUrn: URN.parse('urn:messenger:convo:seed'),
      senderId: def.senderUrn,
      sentTimestamp: def.sentAt as ISODateTimeString,
      typeId: MessageTypeText,
      payloadBytes: encrypted.encryptedData,
      status: def.status,
      receiptMap: {},
      tags: [],
      textContent: def.text,
    };
    await this.chatStorage.saveMessage(message);
  }

  private async seedQuarantineMessage(def: MockMessageDef) {
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
}
