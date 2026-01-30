import { Temporal } from '@js-temporal/polyfill';
import { MESSENGER_USERS } from '../data/users.const';
import { ACTIVE_USER } from './messaging.scenarios';
import { composeScenarios } from '../driver-services/scenario-compositor';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

const NOW = Temporal.Now.instant();

/**
 * SCENARIO: Flight Mode Recovery
 * Uses the Compositor to overlay the Offline Queue onto the Active User.
 */
export const FLIGHT_MODE_RECOVERY = composeScenarios(ACTIVE_USER, {
  local_device: {
    // Override: Clear local history to simulate stale state
    messaging: {
      messages: [], // Clear local history to simulate stale state
    },
  },
  remote_server: {
    network: {
      // Override: Populate server queue
      queuedMessages: [
        {
          id: 'msg-offline-1',
          conversationUrn: MESSENGER_USERS.ALICE,
          senderUrn: MESSENGER_USERS.ALICE,
          type: MessageTypeText,
          text: 'I tried calling you, but you were offline.',
          sentAt: NOW.subtract({ minutes: 5 }).toString() as ISODateTimeString,
          status: 'sent',
        },
        {
          id: 'msg-offline-2',
          conversationUrn: MESSENGER_USERS.ALICE,
          senderUrn: MESSENGER_USERS.ALICE,
          type: MessageTypeText,
          text: 'Call me back when you get this.',
          sentAt: NOW.subtract({ minutes: 4 }).toString() as ISODateTimeString,
          status: 'sent',
        },
      ],
    },
  },
});
