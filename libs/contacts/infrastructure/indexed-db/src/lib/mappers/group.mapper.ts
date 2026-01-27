import { Injectable } from '@angular/core';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ContactGroup } from '@nx-platform-application/contacts-types';
import { StorableGroup } from '../records/group.record';

@Injectable({ providedIn: 'root' })
export class GroupMapper {
  /**
   * Maps a DB record to a Domain Object.
   * * ✅ SIMPLIFIED: No longer requires hydrated Contact entities.
   * Just returns the list of URNs.
   */
  toDomain(record: StorableGroup): ContactGroup {
    return {
      id: URN.parse(record.id),
      directoryId: record.directoryId
        ? URN.parse(record.directoryId)
        : undefined,
      name: record.name,
      description: record.description,
      // Map strings back to URNs
      memberUrns: record.contactIds.map((id) => URN.parse(id)),
      lastModified: record.lastModified as ISODateTimeString,
    };
  }

  toStorable(domain: ContactGroup): StorableGroup {
    return {
      id: domain.id.toString(),
      directoryId: domain.directoryId?.toString() ?? undefined,
      name: domain.name,
      description: domain.description || '',
      // Map URNs to strings for the Index
      contactIds: domain.memberUrns.map((urn) => urn.toString()),
      lastModified: domain.lastModified,
    };
  }
}
