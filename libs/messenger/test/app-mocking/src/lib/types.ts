import {
  URN,
  ISODateTimeString,
  User,
} from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import {
  MessageDeliveryStatus,
  DeliveryStatus,
} from '@nx-platform-application/messenger-types';
import {
  ContentPayload,
  SignalPayload,
} from '@nx-platform-application/messenger-domain-message-content';
import {
  DirectoryGroup,
  DirectoryEntity,
} from '@nx-platform-application/directory-types';

// --- DATA MODEL INTERFACES ---

export interface MockMessageDef {
  id: string;
  senderUrn: URN;
  text: string;
  sentAt: string; // ISO String
  status: MessageDeliveryStatus;
}

export interface ScenarioItem {
  id: string;
  senderUrn: URN;
  sentAt: string | ISODateTimeString;
  status: MessageDeliveryStatus;
  payload: ContentPayload | SignalPayload;
}

export interface MockOutboxDef {
  id: string;
  messageId: string;
  recipientUrns: URN[];
  text: string;
  status: DeliveryStatus;
}

export interface MockPushNotificationConfig {
  permission: NotificationPermission;
  isSubscribed: boolean;
}

// --- CONFIGURATION INTERFACES ---

export interface MockServerAuthState {
  authenticated: boolean;
  user?: User;
}

export interface MockServerIdentityState {
  hasMyKey: boolean;
  keyMismatch?: boolean;
  seeded?: boolean;
}

export interface MockServerNetworkState {
  queuedMessages: MockMessageDef[];
}

export interface MockChatSendConfig {
  shouldFail?: boolean;
  errorMsg?: string;
  latencyMs?: number;
}

export interface MockServerDirectoryState {
  groups?: DirectoryGroup[];
  entities?: DirectoryEntity[];
}

// --- SCRIPTING ---

export type TriggerEvent = 'outbound_message';

export interface TriggerMatcher {
  recipientId?: URN;
  textContains?: string;
  isEphemeral?: boolean;
}

export type ActionType =
  | 'send_delivery_receipt'
  | 'send_read_receipt'
  | 'send_typing_indicator'
  | 'send_text_reply';

export interface ScriptAction {
  type: ActionType;
  delayMs: number;
  payload?: ContentPayload | SignalPayload;
}

export interface ScriptRule {
  on: TriggerEvent;
  match: TriggerMatcher;
  actions: ScriptAction[];
}

export interface ScenarioScript {
  rules: ScriptRule[];
}

/**
 * THE MASTER SCENARIO DEFINITION
 * (Single Source of Truth)
 */
export interface MessengerScenarioData {
  local_device: {
    // 1. Address Book State (CamelCase)
    contactSetup: {
      contacts: Contact[];
      groups?: ContactGroup[];
    };

    // 2. Chat Data State
    messaging: {
      messages: MockMessageDef[]; // History
      outbox: MockOutboxDef[];
      quarantine: MockMessageDef[];
    };

    // 3. Directory State (Network Cache/Mock)
    directory: MockServerDirectoryState;

    // 4. Device Settings
    identity?: { seeded: boolean };
    notifications: MockPushNotificationConfig;
  };

  remote_server: {
    auth: MockServerAuthState;
    identity: MockServerIdentityState;
    network: MockServerNetworkState;
    send: MockChatSendConfig;
  };

  script?: ScenarioScript;
}
