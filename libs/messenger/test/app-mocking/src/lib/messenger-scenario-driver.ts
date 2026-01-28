import { Injectable, inject } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { TransportMessage } from '@nx-platform-application/messenger-types';

import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';

// WORLD SERVICES
import { IdentitySetupService } from './world/identity-setup.service';
import { WorldMessagingService } from './world/world-messaging.service';

// HELPER SERVICES
// ✅ FIX: Correct path to driver services
import { MockLocalStorageBuilder } from './driver-services/mock-local-storage.builder';
import { ScenarioDirectorService } from './driver-services/scenario-director.service';

// MOCK SERVICES
import { MockAuthService } from './services/mock-auth.service';
import { MockKeyService } from './services/mock-key.service';
import { MockChatDataService } from './services/mock-chat-data.service';
import { MockLiveService } from './services/mock-live.service';
import { MockChatSendService } from './services/mock-chat-send.service';
import { MockPushNotificationService } from './services/mock-push-notification.service';
import { MockDirectoryService } from './services/mock-directory.service';

// REAL STORAGE
import {
  ChatStorageService,
  OutboxStorage,
  QuarantineStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-infrastructure-storage';
import { KeyStorageService } from '@nx-platform-application/messenger-infrastructure-key-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import {
  MessengerCryptoService,
  CryptoEngine,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

import { MESSENGER_SCENARIOS } from './scenarios.const';
import { MessengerScenarioData, ScenarioItem } from './types';

@Injectable({ providedIn: 'root' })
export class MessengerScenarioDriver {
  // Mocks
  private authMock = inject(MockAuthService);
  private keyMock = inject(MockKeyService);
  private routerMock = inject(MockChatDataService);
  private liveMock = inject(MockLiveService);
  private sendMock = inject(MockChatSendService);
  private pushMock = inject(MockPushNotificationService);
  private directoryMock = inject(MockDirectoryService);

  // World & Helpers
  private identitySetup = inject(IdentitySetupService);
  private worldMessaging = inject(WorldMessagingService);
  private messageBuilder = inject(MockLocalStorageBuilder);
  private director = inject(ScenarioDirectorService);
  private crypto = inject(CryptoEngine);

  // Storage
  private chatStorage = inject(ChatStorageService);
  private contactsStorage = inject(ContactsStorageService);
  private publicKeysStorage = inject(KeyStorageService);
  private messengerCrypto = inject(MessengerCryptoService);
  private outboxStorage = inject(OutboxStorage);
  private quarantineStorage = inject(QuarantineStorage);
  private keyCache = inject(KeyCacheService);

  async initialize(): Promise<void> {
    (window as any).messengerDriver = this;
    const params = new URLSearchParams(window.location.search);
    const scenarioKey = params.get('scenario') || 'active-user';
    await this.loadScenario(scenarioKey);
  }

  async loadScenario(key: string): Promise<void> {
    const scenario =
      MESSENGER_SCENARIOS[key as keyof typeof MESSENGER_SCENARIOS];
    if (!scenario) {
      console.error(`[Driver] ❌ Scenario '${key}' not found!`);
      return;
    }

    console.groupCollapsed(`[Driver] 🎬 Loading Scenario: ${key}`);

    await this.wipeDevice();

    // 1. Identity & Keys
    await this.identitySetup.configure(
      scenario.remote_server.identity,
      scenario.local_device.contactSetup.contacts, // ✅ FIX: contactSetup
    );

    // 2. Configure Mocks
    this.authMock.loadScenario(scenario.remote_server.auth);
    this.keyMock.loadScenario(scenario.remote_server.identity);
    this.routerMock.loadScenario(scenario.remote_server.network);
    this.sendMock.loadScenario(scenario.remote_server.send);
    this.pushMock.loadScenario(scenario.local_device.notifications);
    this.directoryMock.loadScenario(scenario.local_device.directory); // Directory is conceptually local cache + network

    // 3. Seed Database
    await this.seedLocalDevice(scenario.local_device);

    // 4. Start Director
    this.director.loadScript(scenario.script);

    console.groupEnd();
    console.log(`%c[World] 🌍 READY`, 'color: #0f0; font-weight: bold;');
  }

  private async wipeDevice() {
    console.log('[Driver] 🧹 Wiping Device Storage...');
    await Promise.all([
      this.chatStorage.clearDatabase(),
      this.contactsStorage.clearDatabase(),
      this.publicKeysStorage.clearDatabase(),
      this.messengerCrypto.clearKeys(),
      this.outboxStorage.clearAll(),
      this.quarantineStorage.clear(),
      this.keyCache.clear(),
    ]);
  }

  private async seedLocalDevice(config: MessengerScenarioData['local_device']) {
    // 1. Contacts & Groups (from contactSetup)
    // ✅ FIX: Use new structure
    const { contacts, groups } = config.contactSetup;

    if (contacts.length > 0) {
      console.log(`[Driver] Seeding ${contacts.length} contacts...`);
      await this.contactsStorage.bulkUpsert(contacts);
    }
    if (groups && groups.length > 0) {
      console.log(`[Driver] Seeding ${groups.length} local groups...`);
      await this.contactsStorage.bulkUpsertGroups(groups);
    }

    // 2. Message History (from messaging)
    // ✅ FIX: Use new structure
    const { messages, outbox, quarantine } = config.messaging;

    if (messages.length > 0) {
      console.log(`[Driver] Seeding ${messages.length} history messages...`);
      const items: ScenarioItem[] = messages.map((def) => ({
        id: def.id,
        senderUrn: def.senderUrn,
        sentAt: def.sentAt,
        status: def.status,
        payload: { kind: 'text', text: def.text },
      }));

      const realMessages = this.messageBuilder.build(items);

      await Promise.all(
        realMessages.map((msg) => this.chatStorage.saveMessage(msg)),
      );
    }

    // 3. Outbox
    if (outbox.length > 0) {
      // Outbox seeding logic would go here
    }

    // 4. Quarantine
    if (quarantine.length > 0) {
      console.log(`[Driver] Seeding ${quarantine.length} quarantined items...`);
      for (const def of quarantine) {
        // Generate valid encrypted payload
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
  }
}
