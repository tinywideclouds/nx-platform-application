import { URN } from '@nx-platform-application/platform-types';

// Raw String Literal (If needed for comparison)
export const BROADCAST_TAG_URN = 'urn:messenger:tag:broadcast';

// Domain Object (For usage)
export const messageTagBroadcast = URN.parse(BROADCAST_TAG_URN);
