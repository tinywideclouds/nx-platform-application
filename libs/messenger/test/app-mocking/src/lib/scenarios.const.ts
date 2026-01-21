import { URN } from '@nx-platform-application/platform-types';
import {
  MessageDeliveryStatus,
  DeliveryStatus,
} from '@nx-platform-application/messenger-types';

export const SCENARIO_USERS = {
  ALICE: URN.parse('urn:contacts:user:alice'),
  BOB: URN.parse('urn:contacts:user:bob'),
  ME: URN.parse('urn:contacts:user:me'),
  SPAMMER: URN.parse('urn:contacts:user:spammer'),
};

// --- DEFINITIONS ---

export interface MockMessageDef {
  id: string;
  senderUrn: URN;
  text: string;
  sentAt: string; // ISO Date
  status: MessageDeliveryStatus;
}

export interface MockOutboxDef {
  id: string; // Task ID
  messageId: string;
  recipientUrns: URN[];
  text: string;
  status: DeliveryStatus; // 'queued' | 'processing' | 'failed'
}

export interface MockQuarantineDef {
  messageId: string;
  senderUrn: URN;
  text: string;
  sentAt: string;
}

export interface MessengerScenarioData {
  messages: MockMessageDef[];
  outbox?: MockOutboxDef[];
  quarantine?: MockQuarantineDef[];
}

// --- SCENARIO 1: Empty State ---
const EMPTY: MessengerScenarioData = {
  messages: [],
  outbox: [],
  quarantine: [],
};

// --- SCENARIO 2: Active Conversation ---
const ACTIVE_CHAT: MessengerScenarioData = {
  messages: [
    {
      id: 'msg-101',
      senderUrn: SCENARIO_USERS.ALICE,
      text: 'Hey! Did you see the new mock engine?',
      sentAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      status: 'read',
    },
    {
      id: 'msg-102',
      senderUrn: SCENARIO_USERS.ME,
      text: 'Yes! It makes testing so much faster.',
      sentAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      status: 'read',
    },
    {
      id: 'msg-103',
      senderUrn: SCENARIO_USERS.ALICE,
      text: 'Awesome. Deploying now.',
      sentAt: new Date(Date.now() - 1000 * 60).toISOString(),
      status: 'received',
    },
  ],
};

// --- SCENARIO 3: Failed Sends & Spam ---
const FAILED_SEND: MessengerScenarioData = {
  messages: [],
  outbox: [
    {
      id: 'task-1',
      messageId: 'msg-failed-1',
      recipientUrns: [SCENARIO_USERS.ALICE],
      text: 'This message got stuck in the outbox!',
      status: 'failed',
    },
  ],
  quarantine: [
    {
      messageId: 'spam-1',
      senderUrn: SCENARIO_USERS.SPAMMER,
      text: 'You have won a lottery! Click here.',
      sentAt: new Date().toISOString(),
    },
  ],
};

export const MESSENGER_SCENARIOS = {
  empty: EMPTY,
  'active-chat': ACTIVE_CHAT,
  'failed-send': FAILED_SEND,
};
