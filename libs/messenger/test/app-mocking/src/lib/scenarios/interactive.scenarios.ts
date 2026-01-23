import { Temporal } from '@js-temporal/polyfill';
import { composeScenarios } from '../driver-services/scenario-compositor';
import { ACTIVE_USER } from './messaging.scenarios';
import { MESSENGER_USERS } from '../data/users.const';
import { URN } from '@nx-platform-application/platform-types';

const NOW = Temporal.Now.instant();

export const ACTIVE_USER_INTERACTIVE = composeScenarios(ACTIVE_USER, {
  remote_server: {
    network: {
      queuedMessages: [
        {
          id: 'msg-interactive-start',
          senderUrn: MESSENGER_USERS.ALICE,
          text: 'Hello! Are you there?',
          sentAt: NOW.subtract({ minutes: 1 }).toString(),
          status: 'sent',
        },
      ],
    },
  },
  script: {
    rules: [
      // RULE 1: Reply to TEXT messages (Persistent)
      {
        on: 'outbound_message',
        match: {
          recipientId: URN.parse('urn:lookup:email:alice@example.com'),
          isEphemeral: false, // <--- Ignore Typing Indicators for this rule
        },
        actions: [
          { type: 'send_delivery_receipt', delayMs: 500 },
          { type: 'send_read_receipt', delayMs: 1500 },
          {
            type: 'send_text_reply',
            delayMs: 3000,
            data: { text: 'Loud and clear! How are things?' },
            payload: { kind: 'text', text: 'Loud and clear! How are things?' },
          },
        ],
      },
      // RULE 2: Acknowledge SIGNALS (Ephemeral) - "Testing Reception"
      {
        on: 'outbound_message',
        match: {
          recipientId: URN.parse('urn:lookup:email:alice@example.com'),
          isEphemeral: true, // <--- Match Typing Indicators
        },
        actions: [
          // Just a console log or a simulated 'Typing' back from Alice could go here
          { type: 'send_delivery_receipt', delayMs: 100 },
        ],
      },
    ],
  },
});
