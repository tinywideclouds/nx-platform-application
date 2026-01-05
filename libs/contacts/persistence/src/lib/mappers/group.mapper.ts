import { Injectable } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ContactGroup,
  ContactGroupMember,
} from '@nx-platform-application/contacts-types';
import { StorableGroup, StorableGroupMember } from '../records/group.record';

@Injectable({ providedIn: 'root' })
export class GroupMapper {
  toDomain(g: StorableGroup): ContactGroup {
    return {
      id: URN.parse(g.id),
      name: g.name,
      description: g.description,
      scope: g.scope,
      parentId: g.parentId ? URN.parse(g.parentId) : undefined,
      members: g.members.map((m) => ({
        contactId: URN.parse(m.contactId),
        status: m.status,
        joinedAt: m.joinedAt,
      })),
    };
  }

  toStorable(g: ContactGroup): StorableGroup {
    // Map Domain Members -> Storable Members
    const richMembers: StorableGroupMember[] = g.members.map(
      (m: ContactGroupMember) => ({
        contactId: m.contactId.toString(),
        status: m.status,
        joinedAt:
          m.joinedAt ??
          (Temporal.Now.instant().toString() as ISODateTimeString),
      }),
    );

    // Map Domain Members -> Searchable Index (MultiEntry)
    // 🚨 FIX: Extract the ID string, do not stringify the object
    const contactIdIndex = g.members.map((m) => m.contactId.toString());

    return {
      id: g.id.toString(),
      name: g.name,
      description: g.description,
      scope: g.scope,
      parentId: g.parentId?.toString(),
      contactIds: contactIdIndex,
      members: richMembers,
      lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    };
  }
}
