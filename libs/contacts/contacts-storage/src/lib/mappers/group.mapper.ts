import { Injectable } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ContactGroup } from '@nx-platform-application/contacts-types';
import { StorableGroup, StorableGroupMember } from '../records/group.record';

@Injectable({ providedIn: 'root' })
export class GroupMapper {
  toDomain(g: StorableGroup): ContactGroup {
    return {
      id: URN.parse(g.id),
      name: g.name,
      description: g.description,
      // We explicitly cast here because the ContactGroup interface in
      // @nx-platform-application/contacts-types needs to be updated to support
      // scope/parentId. Ideally, we update that library next.
      scope: g.scope,
      parentId: g.parentId ? URN.parse(g.parentId) : undefined,

      members: g.members.map((m) => ({
        contactId: URN.parse(m.contactId),
        role: m.role,
        status: m.status as any,
        joinedAt: m.joinedAt,
      })),

      // Backward compatibility
      contactIds: g.contactIds.map((id) => URN.parse(id)),
    } as any;
  }

  toStorable(
    g: ContactGroup & { scope?: 'local' | 'messenger'; parentId?: URN },
  ): StorableGroup {
    // Migration Logic: If coming from old UI without members array
    const membersList = (g as any).members || [];

    const richMembers: StorableGroupMember[] =
      membersList.length > 0
        ? membersList.map((m: any) => ({
            contactId: m.contactId.toString(),
            role: m.role || 'member',
            status: m.status || 'joined',
            joinedAt: m.joinedAt,
          }))
        : g.members.map((id) => ({
            contactId: id.toString(),
            role: 'member',
            status: 'joined', // Assume legacy groups are fully joined
          }));

    return {
      id: g.id.toString(),
      name: g.name,
      description: g.description,
      scope: g.scope || 'local',
      parentId: g.parentId?.toString(),

      contactIds: g.members.map((id) => id.toString()),
      members: richMembers,

      lastModified: new Date().toISOString() as ISODateTimeString,
    };
  }
}
