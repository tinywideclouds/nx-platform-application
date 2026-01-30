import { NEW_USER, FRESH_LOGIN } from './startup.scenarios';
import { ACTIVE_USER } from './messaging.scenarios';
import { FLIGHT_MODE_RECOVERY } from './offline.scenarios';
import { ACTIVE_USER_INTERACTIVE } from './interactive.scenarios';
import {
  ACTIVE_USER_LOCAL_GROUP,
  ACTIVE_USER_NETWORK_GROUP,
} from './groups.scenarios';
import { GROUP_UPGRADE_FLOW } from './group-interactive.scenarios';

export const MESSENGER_SCENARIOS = {
  'new-user': NEW_USER,
  'fresh-login': FRESH_LOGIN,
  'active-user': ACTIVE_USER,
  'flight-mode': FLIGHT_MODE_RECOVERY,
  'active-user-interactive': ACTIVE_USER_INTERACTIVE,
  'group-local': ACTIVE_USER_LOCAL_GROUP,
  'group-network': ACTIVE_USER_NETWORK_GROUP,
  'group-upgrade-flow': GROUP_UPGRADE_FLOW,
};
