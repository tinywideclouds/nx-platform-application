import { ISODateTimeString } from '@nx-platform-application/platform-types';

import {
  GroupMemberStatus,
  GroupScope,
} from '@nx-platform-application/contacts-types';

export interface StorableGroupMember {
  contactId: string;
  role: 'owner' | 'admin' | 'member';
  status: GroupMemberStatus;
  joinedAt?: ISODateTimeString;
}

export interface StorableGroup {
  id: string;
  name: string;
  description?: string;
  scope: GroupScope;
  parentId?: string;
  contactIds: string[]; // MultiEntry Index
  members: StorableGroupMember[];
  lastModified: ISODateTimeString;
}
