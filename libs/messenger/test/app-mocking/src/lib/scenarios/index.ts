import { NEW_USER, FRESH_LOGIN } from './startup.scenarios';
import { ACTIVE_USER } from './messaging.scenarios';
import { FLIGHT_MODE_RECOVERY } from './offline.scenarios';
import { ACTIVE_USER_INTERACTIVE } from './interactive.scenarios'; // ✅ Import

export const MESSENGER_SCENARIOS = {
  'new-user': NEW_USER,
  'fresh-login': FRESH_LOGIN,
  'active-user': ACTIVE_USER,
  'flight-mode': FLIGHT_MODE_RECOVERY,
  'active-user-interactive': ACTIVE_USER_INTERACTIVE, // ✅ Register
};
