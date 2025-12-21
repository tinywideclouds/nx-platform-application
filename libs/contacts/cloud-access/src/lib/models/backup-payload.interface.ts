// libs/contacts/cloud-access/src/lib/models/backup-payload.interface.ts

import {
  Contact,
  ContactGroup,
  BlockedIdentity,
} from '@nx-platform-application/contacts-types';

export interface BackupPayload {
  version: number;
  timestamp: string;
  sourceDevice: string;
  contacts: Contact[];
  groups: ContactGroup[];
  blocked: BlockedIdentity[];
}
