import { Injectable } from '@angular/core';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  DirectoryGroup,
  DirectoryEntity,
} from '@nx-platform-application/directory-types';
import { StorableGroup } from '../records/directory.record';

@Injectable({ providedIn: 'root' })
export class DirectoryGroupMapper {
  toDomain(record: StorableGroup, members: DirectoryEntity[]): DirectoryGroup {
    return {
      id: URN.parse(record.urn),
      members: members,
      memberState: record.memberState,
      lastUpdated: record.lastUpdated as ISODateTimeString,
    };
  }

  toStorable(group: DirectoryGroup): StorableGroup {
    return {
      urn: group.id.toString(),
      memberState: group.memberState,
      // Flatten the objects into a list of strings for the DB Index
      memberUrns: group.members.map((m) => m.id.toString()),
      lastUpdated: group.lastUpdated,
    };
  }
}
