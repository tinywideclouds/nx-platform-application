import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { GroupMemberStatus } from '@nx-platform-application/contacts-types';
import { GroupNetworkStorageApi } from '@nx-platform-application/contacts-api';

import { ContactsDatabase } from '@nx-platform-application/contacts-persistence';

@Injectable({ providedIn: 'root' })
export class GroupNetworkStorage implements GroupNetworkStorageApi {
  private readonly db = inject(ContactsDatabase);

  /**
   * ATOMIC PROTOCOL WRITE:
   * Updates a specific member's status (joined/left) based on Network Consensus.
   */
  async updateGroupMemberStatus(
    groupUrn: URN,
    contactUrn: URN,
    status: GroupMemberStatus,
  ): Promise<void> {
    const idStr = groupUrn.toString();

    await this.db.transaction('rw', this.db.groups, async () => {
      const group = await this.db.groups.get(idStr);
      if (!group) return;

      const updatedMembers = group.members.map((m) => {
        if (m.contactId === contactUrn.toString()) {
          const time =
            status === 'joined'
              ? Temporal.Now.instant().toString()
              : m.joinedAt;
          return {
            ...m,
            status,
            joinedAt: time as ISODateTimeString,
          };
        }
        return m;
      });

      await this.db.groups.update(idStr, {
        members: updatedMembers,
        lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
      });
    });
  }
}
