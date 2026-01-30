import { Temporal } from '@js-temporal/polyfill';
import { composeScenarios } from '../driver-services/scenario-compositor';
import { ACTIVE_USER_LOCAL_GROUP } from './groups.scenarios';
import { MESSENGER_USERS } from '../data/users.const';
import { URN } from '@nx-platform-application/platform-types';

const NOW = Temporal.Now.instant();

/**
 * SCENARIO: Local to Network Upgrade
 * Starts with a Local Group. When the user creates the Network Group,
 * the World automatically accepts the invites.
 */
export const GROUP_UPGRADE_FLOW = composeScenarios(ACTIVE_USER_LOCAL_GROUP, {
  script: {
    rules: [
      // 1. ALICE: Eager (Joins in 1s)
      {
        on: 'outbound_message',
        match: {
          recipientId: MESSENGER_USERS.ALICE,
          payloadKind: 'group-invite', // ✅ Match the Protocol Message
        },
        actions: [
          { type: 'send_delivery_receipt', delayMs: 200 },
          { type: 'accept_group_invite', delayMs: 1000 },
        ],
      },

      // 2. BOB: Casual (Joins in 3s)
      {
        on: 'outbound_message',
        match: {
          recipientId: MESSENGER_USERS.BOB,
          payloadKind: 'group-invite',
        },
        actions: [
          { type: 'send_delivery_receipt', delayMs: 500 },
          { type: 'accept_group_invite', delayMs: 3000 },
        ],
      },

      // 3. CHARLIE: Slow (Joins in 5s)
      {
        on: 'outbound_message',
        match: {
          recipientId: URN.parse('urn:contacts:user:charlie'), // Manually define Charlie
          payloadKind: 'group-invite',
        },
        actions: [
          { type: 'send_delivery_receipt', delayMs: 800 },
          { type: 'accept_group_invite', delayMs: 5000 },
        ],
      },

      // 4. DAVE: Ghosting (Does not accept)
      // We purposefully define NO rule for Dave.
      // He will remain "Invited" (Pending) forever to verify the UI handles partial joins.
    ],
  },
});
