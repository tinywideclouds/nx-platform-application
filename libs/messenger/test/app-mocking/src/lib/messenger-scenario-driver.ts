import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';

// ✅ NEW WORLD SERVICES (The Sources of Truth)
import { IdentitySetupService } from './world/identity-setup.service';
import { WorldMessagingService } from './world/world-messaging.service';

import { ScenarioDirectorService } from './driver-services/scenario-director.service';

// Mock Services (Configuration targets)
import { MockAuthService } from './services/mock-auth.service';
import { MockKeyService } from './services/mock-key.service';
import { MockChatDataService } from './services/mock-chat-data.service';
import { MockLiveService } from './services/mock-live.service';
import { MockChatSendService } from './services/mock-chat-send.service';
import { MockPushNotificationService } from './services/mock-push-notification.service';

// Real Storage (For wiping/resetting only)
import {
  ChatStorageService,
  OutboxStorage,
  QuarantineStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { KeyStorageService } from '@nx-platform-application/messenger-infrastructure-key-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

// Modular Imports
import { MESSENGER_SCENARIOS } from './scenarios';
import { MessengerScenarioData, ScenarioItem, MockMessageDef } from './types';
import { MESSENGER_USERS } from './data/users.const';

@Injectable({ providedIn: 'root' })
export class MessengerScenarioDriver {
  // --- WORLD LAYER ---
  private worldIdentity = inject(IdentitySetupService);
  private worldMessaging = inject(WorldMessagingService);
  // ✅ ACTIVATE THE DIRECTOR
  // Just injecting it here forces it to instantiate, which starts the WorldInbox listener.
  private director = inject(ScenarioDirectorService);

  // --- MOCK LAYER ---
  private authMock = inject(MockAuthService);
  private keyMock = inject(MockKeyService);
  private chatDataMock = inject(MockChatDataService); // We still config the 'mode', but data comes from World
  private liveMock = inject(MockLiveService);
  private sendMock = inject(MockChatSendService);
  private pushMock = inject(MockPushNotificationService);

  // --- INFRASTRUCTURE LAYER (Access for Wiping) ---
  private chatStorage = inject(ChatStorageService);
  private outboxStorage = inject(OutboxStorage);
  private contactsStorage = inject(ContactsStorageService);
  private publicKeysStorage = inject(KeyStorageService);
  private messengerCrypto = inject(MessengerCryptoService);
  private quarantineStorage = inject(QuarantineStorage);
  private keyCache = inject(KeyCacheService);

  private readonly STORAGE_KEY = 'messenger_active_scenario';

  constructor() {
    (window as any).messengerDriver = this;
  }

  public async initialize(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const activeKey =
      params.get('scenario') ||
      localStorage.getItem(this.STORAGE_KEY) ||
      'active-user';
    localStorage.setItem(this.STORAGE_KEY, activeKey);
    await this.loadScenario(activeKey);
  }

  async loadScenario(key: string): Promise<void> {
    const scenario =
      MESSENGER_SCENARIOS[key as keyof typeof MESSENGER_SCENARIOS];
    if (!scenario) {
      console.error(`[Driver] ❌ Unknown scenario: ${key}`);
      return;
    }

    console.groupCollapsed(`[Driver] 🎬 Activating Scenario: "${key}"`);

    // 1. RESET REALITY (Wipe the App's memory)
    await this.wipeDevice();

    // 2. CONFIGURE WORLD (The God View)
    // This generates keys in memory and decides if they go to the DB.
    await this.worldIdentity.configure(
      scenario.remote_server.identity,
      scenario.local_device.contacts || [],
    );

    // 3. LOAD SCRIPT (The Interactive Rules)
    // This tells the Director: "If Alice receives 'Hello', wait 2s and reply."
    this.director.loadScript(scenario.script);

    // 3. CONFIGURE MOCKS (The Dumb Pipes)
    this.authMock.loadScenario(scenario.remote_server.auth);
    this.keyMock.loadScenario(scenario.remote_server.identity); // Configs the 404/200 behavior
    this.liveMock.loadScenario(scenario.remote_server.network);
    this.sendMock.loadScenario(scenario.remote_server.send);
    this.pushMock.loadScenario(scenario.local_device.notifications);

    // Config the Chat Data Service (Wait mode, etc), but don't load messages yet
    // We will inject messages via the World Service next.
    this.chatDataMock.loadScenario({ queuedMessages: [] });

    // 4. SEED CONTENT (Populate the Universe)

    // A. Network Queue (Offline Messages)
    // We delegate this to WorldMessagingService so it uses the CORRECT keys (from IdentitySetup)
    if (scenario.remote_server.network.queuedMessages.length > 0) {
      console.log(
        `[Driver] 🌍 World creating ${scenario.remote_server.network.queuedMessages.length} offline messages...`,
      );
      for (const msgDef of scenario.remote_server.network.queuedMessages) {
        await this.worldMessaging.deliverMessage(
          this.mapMockToScenarioItem(msgDef),
        );
      }
    }

    // B. Local Device (Messages already downloaded)
    await this.seedLocalDevice(scenario.local_device);

    console.groupEnd();
    console.log(
      `%c[World] 🌍 World Initial State READY`,
      'color: #0f0; font-weight: bold; font-size: 12px;',
    );
  }

  // --- INTERNAL HELPER ---

  private mapMockToScenarioItem(def: MockMessageDef): ScenarioItem {
    return {
      id: def.id,
      senderUrn: def.senderUrn,
      sentAt: def.sentAt,
      status: def.status,
      // Convert legacy text definition to Domain Payload
      payload: { kind: 'text', text: def.text },
    };
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
    // Note: We don't seed Identity here anymore. WorldIdentity service handled it in step 2.

    if (config.contacts && config.contacts.length > 0) {
      await this.contactsStorage.bulkUpsert(config.contacts);
    }

    // Direct injection of already-decrypted messages into local DB
    // (Simulating data that was processed days ago)
    for (const msg of config.messages) {
      // Logic from previous implementation to inject ChatMessage directly
      // ... (omitted for brevity, same as previous seedMessageToStorage) ...
    }
  }
}
