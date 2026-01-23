import {
  URN,
  ISODateTimeString,
  User,
} from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import {
  MessageDeliveryStatus,
  DeliveryStatus,
} from '@nx-platform-application/messenger-types';
import {
  ContentPayload,
  SignalPayload,
} from '@nx-platform-application/messenger-domain-message-content';

// --- DATA MODEL INTERFACES ---

export interface MockMessageDef {
  id: string;
  senderUrn: URN;
  text: string;
  sentAt: string; // ISO String (Temporal)
  status: MessageDeliveryStatus;
}

export interface ScenarioItem {
  id: string;
  senderUrn: URN;
  sentAt: string | ISODateTimeString;
  status: MessageDeliveryStatus;

  // STRICT TYPING: Only allow valid App Domain payloads
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

// --- SERVICE CONFIGURATION INTERFACES ---

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

// --- DIRECTOR SCRIPT TYPES ---

export type TriggerEvent = 'outbound_message';

export interface TriggerMatcher {
  recipientId?: URN;
  textContains?: string;
  /**
   * Distinguishes between Ephemeral Signals (e.g. Typing) and Durable Data.
   *
   * true  = Matches ONLY Ephemeral Signals (e.g. Typing Indicators)
   * false = Matches Durable Data (Text, Images, AND Read Receipts)
   * undefined = Matches Both
   */
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

  // ✅ UPDATE: Runtime actions now use the same Domain Payload
  // This allows complex scripted responses (e.g. Asset Reveal)
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

// --- MASTER SCENARIO DEFINITION ---

export interface MessengerScenarioData {
  local_device: {
    messages: MockMessageDef[];
    outbox: MockOutboxDef[];
    quarantine: MockMessageDef[];
    contacts: Contact[];
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
