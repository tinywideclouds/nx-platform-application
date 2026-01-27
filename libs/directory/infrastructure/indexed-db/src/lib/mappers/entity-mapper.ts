import { Injectable } from '@angular/core';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { DirectoryEntity } from '@nx-platform-application/directory-types';
import { StorableDirectoryEntity } from '../records/directory.record';

@Injectable({ providedIn: 'root' })
export class DirectoryEntityMapper {
  toDomain(record: StorableDirectoryEntity): DirectoryEntity {
    return {
      id: URN.parse(record.urn),
      type: URN.parse(record.type),
      lastSeenAt: record.lastAccessed as ISODateTimeString,
    };
  }

  toStorable(entity: DirectoryEntity): StorableDirectoryEntity {
    return {
      urn: entity.id.toString(),
      type: entity.type.toString(),
      lastAccessed: entity.lastSeenAt,
    };
  }
}
