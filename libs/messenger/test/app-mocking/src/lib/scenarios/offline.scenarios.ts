import { Temporal } from '@js-temporal/polyfill';
import { MESSENGER_USERS } from '../data/users.const';
import { ACTIVE_USER } from './messaging.scenarios';
import { composeScenarios } from '../driver-services/scenario-compositor';

const NOW = Temporal.Now.instant();

/**
 * SCENARIO: Flight Mode Recovery
 * Uses the Compositor to overlay the Offline Queue onto the Active User.
 */
export const FLIGHT_MODE_RECOVERY = composeScenarios(ACTIVE_USER, {
  local_device: {
    // Override: Clear local history to simulate stale state
    messages: [],
  },
  remote_server: {
    network: {
      // Override: Populate server queue
      queuedMessages: [
        {
          id: 'msg-offline-1',
          senderUrn: MESSENGER_USERS.ALICE,
          text: 'I tried calling you, but you were offline.',
          sentAt: NOW.subtract({ minutes: 5 }).toString(),
          status: 'sent',
        },
        {
          id: 'msg-offline-2',
          senderUrn: MESSENGER_USERS.ALICE,
          text: 'Call me back when you get this.',
          sentAt: NOW.subtract({ minutes: 4 }).toString(),
          status: 'sent',
        },
      ],
    },
  },
});
